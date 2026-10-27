import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function filesIn(root) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  walk(root);
  return out.sort();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function safeRelative(rel) {
  return typeof rel === 'string' && rel !== '' && !path.isAbsolute(rel) && !rel.includes('\\') && rel.split('/').every(part => part && part !== '.' && part !== '..');
}

function regularFile(root, rel) {
  let current = root;
  try {
    if (fs.lstatSync(root).isSymbolicLink()) return false;
    for (const part of rel.split('/')) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) return false;
    }
    return fs.lstatSync(current).isFile();
  } catch { return false; }
}

function readLedger(ledger) {
  if (!ledger || !fs.existsSync(ledger)) return null;
  try {
    const record = JSON.parse(fs.readFileSync(ledger, 'utf8'));
    if (!Array.isArray(record.files) || record.files.some((item) => !safeRelative(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256)) || new Set(record.files.map(item => item.path)).size !== record.files.length) {
      return { damaged: true };
    }
    return new Map(record.files.map((item) => [item.path, item.sha256]));
  } catch {
    return { damaged: true };
  }
}

function matchesLedger(target, expected) {
  if (!expected || expected.damaged || !fs.existsSync(target)) return false;
  const actual = filesIn(target);
  if (actual.length !== expected.size) return false;
  return actual.every((rel) => regularFile(target, rel) && expected.get(rel) === sha256(path.join(target, rel)));
}

function assertSourceIntact(source) {
  const manifest = path.join(source, 'SHA256SUMS.txt');
  if (!fs.existsSync(manifest)) throw new Error('来源损坏');
  if (!regularFile(source, 'SHA256SUMS.txt')) throw new Error('来源损坏');
  const listed = new Set();
  for (const line of fs.readFileSync(manifest, 'utf8').split('\n').filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (!match || !safeRelative(match[2]) || listed.has(match[2]) || !regularFile(source, match[2])) throw new Error('来源损坏');
    listed.add(match[2]);
    if (sha256(path.join(source, match[2])) !== match[1]) throw new Error('来源损坏');
  }
  const actual = filesIn(source).filter(rel => rel !== 'SHA256SUMS.txt');
  if (!listed.size || actual.length !== listed.size || actual.some(rel => !listed.has(rel))) throw new Error('来源损坏');
}

function canInstallFresh(target, ledger) {
  return !fs.existsSync(target) && !fs.existsSync(ledger);
}

function differences(target, expected) {
  const actual = new Set(fs.existsSync(target) ? filesIn(target) : []);
  const known = expected instanceof Map ? expected : new Map();
  const changes = [];
  for (const [rel, hash] of known) {
    const file = path.join(target, rel);
    if (!fs.existsSync(file)) changes.push({ path: rel, reason: 'missing' });
    else if (!regularFile(target, rel) || sha256(file) !== hash) changes.push({ path: rel, reason: 'changed' });
  }
  for (const rel of actual) {
    if (!known.has(rel)) changes.push({ path: rel, reason: 'extra' });
  }
  if (!expected) changes.push({ path: '', reason: 'unclassified' });
  return changes;
}

export function installSkill({ source, target, ledger, decision }) {
  assertSourceIntact(source);
  const expected = readLedger(ledger);
  const sourceFiles = filesIn(source).filter((rel) => rel !== 'SHA256SUMS.txt');
  const actual = fs.existsSync(target) ? filesIn(target) : [];
  const sameHash = expected instanceof Map && actual.length === sourceFiles.length && sourceFiles.every((rel) => {
    const current = path.join(target, rel);
    return regularFile(target, rel) && expected.get(rel) === sha256(path.join(source, rel)) && fs.existsSync(current) && sha256(current) === sha256(path.join(source, rel));
  });
  if (sameHash) return { outcome: 'reused' };
  const changed = !canInstallFresh(target, ledger) && !matchesLedger(target, expected);
  if (changed && decision !== 'replace') {
    return {
      outcome: decision === 'cancel' ? 'cancelled' : 'ask',
      changes: differences(target, expected),
    };
  }
  const outcome = changed ? 'replaced' : expected instanceof Map ? 'updated' : 'installed';
  const targetAbs = path.resolve(target);
  const ledgerAbs = path.resolve(ledger);
  if (ledgerAbs === targetAbs || ledgerAbs.startsWith(targetAbs + path.sep)) throw new Error('安装清单必须位于Skill目录外');
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  const transaction = fs.mkdtempSync(path.join(path.dirname(targetAbs), '.install-'));
  const staged = path.join(transaction, 'new');
  const backup = path.join(transaction, 'old');
  const pendingLedger = `${ledgerAbs}.pending-${crypto.randomUUID()}`;
  let movedOld = false;
  let movedNew = false;
  let committed = false;
  try {
    fs.mkdirSync(staged);
    for (const rel of sourceFiles) {
      fs.mkdirSync(path.dirname(path.join(staged, rel)), { recursive: true });
      fs.copyFileSync(path.join(source, rel), path.join(staged, rel));
    }
    const record = { files: sourceFiles.map(rel => ({ path: rel, sha256: sha256(path.join(staged, rel)) })) };
    fs.writeFileSync(pendingLedger, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    if (fs.existsSync(targetAbs)) { fs.renameSync(targetAbs, backup); movedOld = true; }
    fs.renameSync(staged, targetAbs);
    movedNew = true;
    fs.renameSync(pendingLedger, ledgerAbs);
    committed = true;
  } catch (error) {
    if (movedNew) fs.rmSync(targetAbs, { recursive: true, force: true });
    if (movedOld) fs.renameSync(backup, targetAbs);
    throw error;
  } finally {
    fs.rmSync(pendingLedger, { force: true });
    // If rollback itself fails, retain the old tree for manual recovery.
    if (committed || !fs.existsSync(backup)) fs.rmSync(transaction, { recursive: true, force: true });
  }
  return { outcome };
}

export function uninstallSkill({ target, ledger }) {
  const expected = readLedger(ledger);
  const entries = expected instanceof Map ? expected : new Map();
  let kept = !(expected instanceof Map);
  for (const [rel, hash] of entries) {
    const file = path.join(target, rel);
    if (regularFile(target, rel) && sha256(file) === hash) fs.rmSync(file);
    else kept = true;
  }
  if (fs.existsSync(target) && filesIn(target).some((rel) => !entries.has(rel))) kept = true;
  if (!kept && fs.existsSync(target) && filesIn(target).length === 0) fs.rmSync(target, { recursive: true });
  if (!kept && fs.existsSync(ledger)) fs.rmSync(ledger);
  return { outcome: kept ? 'kept' : 'uninstalled' };
}

const FILE_MARKERS = new Set(['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'go.mod', 'go.work', 'pubspec.yaml', 'Package.swift', 'Podfile', 'tsconfig.json']);
const EXTENSION_MARKERS = ['.sln', '.csproj', '.cs', '.xaml', '.kt', '.xcodeproj', '.xcworkspace'];
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'vendor', 'dist', 'coverage']);

function hasTestEnvironment(project) {
  if (!fs.existsSync(project)) return false;
  const pending = [project];
  while (pending.length) {
    const current = pending.pop();
    for (const name of fs.readdirSync(current)) {
      const abs = path.join(current, name);
      if (fs.statSync(abs).isDirectory()) {
        if (name.endsWith('.xcodeproj') || name.endsWith('.xcworkspace')) return true;
        if (!SKIPPED_DIRECTORIES.has(name)) pending.push(abs);
        continue;
      }
      if (FILE_MARKERS.has(name) || EXTENSION_MARKERS.some((extension) => name.endsWith(extension))) return true;
      if (name !== 'package.json') continue;
      const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
      if (parsed.scripts?.test || parsed.dependencies || parsed.devDependencies) return true;
    }
  }
  return false;
}

export function checkGeneratorReady({ project, skills }) {
  if (hasTestEnvironment(project)) return { outcome: 'ready' };
  if (!fs.existsSync(path.join(skills, 'unit-test-init'))) return { outcome: 'missing', items: ['unit-test-init'] };
  return { outcome: 'ready' };
}

export function uninstallSkills({ skills }) {
  const results = skills.map((skill) => ({ name: skill.name || '', ...uninstallSkill(skill) }));
  return { outcome: results.some((item) => item.outcome === 'kept') ? 'kept' : 'uninstalled', results };
}

export function installSkills({ skills, decision }) {
  const pending = [];
  const outcomes = new Set();
  const results = [];
  for (const skill of skills) {
    const result = installSkill({ ...skill, decision });
    outcomes.add(result.outcome);
    results.push({ name: skill.name, outcome: result.outcome });
    if (result.outcome === 'ask') pending.push(skill.name);
  }
  if (pending.length) return { outcome: 'ask', pending, results };
  if (outcomes.has('replaced')) return { outcome: 'replaced', results };
  if (outcomes.has('cancelled')) return { outcome: 'cancelled', results };
  return { outcome: 'updated', results };
}

#!/usr/bin/env node
// 升级 product-workflow 项目资产：state、原型回链、评审看板和章程托管块。
import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { canonicalStatus } from './validate_workflow_state.mjs';
import { preparePrototype } from './prepare_prototype.mjs';
import { listSliceDirs, migrateSlice as migrateBoardSlice } from './migrate_review_board.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const suiteRoot = path.resolve(scriptDir, '..', '..');
const defaultVersionFile = path.join(suiteRoot, 'VERSION');
const defaultCharterTemplate = path.join(suiteRoot, 'product-setup', 'references', 'agents-charter-template.md');
const BEGIN_RE = /<!-- BEGIN product-workflow charter suite=(v?[^\s]+) -->/;
const BLOCK_RE = /<!-- BEGIN product-workflow charter suite=v?[^\s]+ -->[\s\S]*?<!-- END product-workflow charter -->/;
const HASH_RE = /\n<!-- product-workflow charter source-sha256=([a-f0-9]{64}) -->/;
const MIGRATION_LEDGER = '.product-workflow-migrations.json';

function parseVersion(version) {
  const parts = String(version || '').replace(/^v/, '').split('.').map(Number);
  return parts.length === 3 && parts.every(Number.isInteger) ? parts : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error(`无法比较套件版本：${left} / ${right}`);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

async function readMigrationLedger(root) {
  const file = path.join(root, MIGRATION_LEDGER);
  if (!(await exists(file))) return null;
  const value = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`迁移账本必须是 JSON 对象：${file}`);
  }
  if (!Array.isArray(value.applied)) {
    throw new Error(`迁移账本缺少 applied 数组：${file}`);
  }
  return { ...value, file };
}

async function writeMigrationLedger(root, ledger) {
  const file = path.join(root, MIGRATION_LEDGER);
  await fs.writeFile(file, `${JSON.stringify(ledger, null, 2)}\n`);
  return file;
}

async function inferMigrationSource(root, slices) {
  for (const fileName of ['AGENTS.md', 'CLAUDE.md']) {
    const file = path.join(root, fileName);
    if (!(await exists(file))) continue;
    const text = await fs.readFile(file, 'utf8');
    const version = text.match(BEGIN_RE)?.[1];
    if (version) return { version, source: `charter:${fileName}` };
  }
  for (const slice of slices) {
    if (await exists(path.join(slice, '.product-workflow-portal.json'))) {
      return { version: 'v0.7.0', source: 'legacy-sidecar' };
    }
  }
  return { version: null, source: 'unknown' };
}

function appliedMigrationIds(ledger) {
  return new Set((ledger?.applied || []).map((item) => (
    typeof item === 'string' ? item : item?.id
  )).filter(Boolean));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readSuiteVersion(versionFile = defaultVersionFile) {
  const first = (await fs.readFile(versionFile, 'utf8')).split(/\r?\n/, 1)[0].trim();
  const match = first.match(/^(?:product-workflow|haitian-pw)-(\d+\.\d+\.\d+)$/);
  if (!match) throw new Error(`VERSION 首行不是 product-workflow-x.y.z 或旧 haitian-pw-x.y.z：${first}`);
  return `v${match[1]}`;
}

function normalizeBlock(block) {
  return block
    .replace(/\r\n/g, '\n')
    .replace(HASH_RE, '')
    .replace(BEGIN_RE, '<!-- BEGIN product-workflow charter suite=VERSION -->')
    .trim();
}

function blockHash(block) {
  return createHash('sha256').update(normalizeBlock(block)).digest('hex');
}

export async function desiredCharterBlock(version, templateFile = defaultCharterTemplate) {
  const template = await fs.readFile(templateFile, 'utf8');
  const block = template.match(BLOCK_RE)?.[0];
  if (!block) throw new Error(`章程模板缺托管块：${templateFile}`);
  const versioned = block.replace(BEGIN_RE, `<!-- BEGIN product-workflow charter suite=${version} -->`);
  return versioned.replace('\n', `\n<!-- product-workflow charter source-sha256=${blockHash(versioned)} -->\n`);
}

export async function refreshManagedCharter(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const candidates = [path.join(root, 'AGENTS.md'), path.join(root, 'CLAUDE.md')];
  const charterFile = candidates.find((file) => options.charterFile === file)
    || await (async () => {
      for (const file of candidates) if (await exists(file)) return file;
      return null;
    })();
  if (!charterFile) return { action: 'not-found', file: null };

  const original = await fs.readFile(charterFile, 'utf8');
  // A minimal Setup is an explicit scope choice, not an older full charter.
  // Never inject full workflow rules or overwrite user edits through migration.
  if (original.includes('<!-- BEGIN product-setup minimal -->')) {
    return { action: 'minimal-kept', file: charterFile };
  }
  const version = options.version || await readSuiteVersion(options.versionFile);
  const desired = await desiredCharterBlock(version, options.templateFile);
  const current = original.match(BLOCK_RE)?.[0];
  if (!current) return { action: 'no-managed-block', file: charterFile, version };

  const currentVersion = current.match(BEGIN_RE)?.[1];
  const recordedHash = current.match(HASH_RE)?.[1];
  const matchesDesired = normalizeBlock(current) === normalizeBlock(desired);
  // 有 hash：必须和当前块一致，否则视为人工改过。
  // 无 hash 且版本落后：0.4.0 现场块，按官方升级刷新。
  // 无 hash 且已是当前版本：内容必须能对上现行模板，才能补 hash。
  const currentIsIntact = recordedHash
    ? recordedHash === blockHash(current)
    : matchesDesired || currentVersion !== version;
  if (!currentIsIntact) {
    throw new Error(`章程托管块与已记录源不一致，疑似有人改过：${charterFile}\n请先人工裁决块内差异；块外内容未改。`);
  }
  if (currentVersion === version && current === desired) return { action: 'kept', file: charterFile, version };

  const updated = original.replace(BLOCK_RE, desired);
  await fs.writeFile(charterFile, updated);
  return { action: 'refreshed', file: charterFile, from: currentVersion, version };
}

export async function migrateWorkflowState(slice) {
  const file = path.join(path.resolve(slice), '.workflow-state.json');
  if (!(await exists(file))) return { action: 'not-found', file };
  const original = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  if (!original || typeof original !== 'object' || Array.isArray(original)) {
    throw new Error(`state 必须是 JSON 对象：${file}`);
  }

  const state = { ...original };
  let changed = false;
  if (state.schema_version === undefined) {
    state.schema_version = 1;
    changed = true;
  }
  if (state.current_stage === undefined && state.currentStage !== undefined) {
    state.current_stage = state.currentStage;
    changed = true;
  }
  if (state.currentStage !== undefined) {
    delete state.currentStage;
    changed = true;
  }
  if (state.stages === undefined && state.phases !== undefined) {
    state.stages = state.phases;
    delete state.phases;
    changed = true;
  }
  if (state.stages && typeof state.stages === 'object' && !Array.isArray(state.stages)) {
    const stages = {};
    for (const [id, value] of Object.entries(state.stages)) {
      if (typeof value === 'string') {
        stages[id] = { status: canonicalStatus(value) || value };
        changed = true;
      } else if (value && typeof value === 'object') {
        const status = canonicalStatus(value);
        if (status && status !== value.status) {
          stages[id] = { ...value, status };
          changed = true;
        } else {
          stages[id] = value;
        }
      } else {
        stages[id] = value;
      }
    }
    state.stages = stages;
  }

  if (changed) await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
  return { action: changed ? 'migrated' : 'kept', file };
}

export async function migratePrototypeBacklink(slice) {
  const file = path.join(path.resolve(slice), 'prototype.html');
  if (!(await exists(file))) return { action: 'not-found', file };
  const original = await fs.readFile(file, 'utf8');
  const legacy = /(href\s*=\s*["'])(?:\.\/)?index\.html(?:\?[^"'#]*)?#prototype(?=["'])/gi;
  const updated = original.replace(legacy, '$1.review-board/index.html#prototype');
  if (updated !== original) await fs.writeFile(file, updated);
  const prepared = await preparePrototype(slice);
  return { action: updated !== original || prepared.changed ? 'migrated' : 'kept', file };
}

const MIGRATIONS_DIR = path.join(scriptDir, 'migrations');
const STEP_FILE_RE = /^\d{12}-.+\.mjs$/;

export async function loadVersionedMigrations(dir = MIGRATIONS_DIR) {
  const names = (await fs.readdir(dir)).filter((name) => STEP_FILE_RE.test(name)).sort();
  const steps = [];
  for (const name of names) {
    const mod = await import(path.join(dir, name));
    const step = mod.default;
    if (!step?.id || !step?.target || typeof step.apply !== 'function') {
      throw new Error(`迁移步骤缺少 id/target/apply：${name}`);
    }
    steps.push({ ...step, file: name });
  }
  return steps;
}

export async function expandMigrationBatch(projectRoot) {
  const files = [];
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`迁移快照包含符号链接：${path.relative(projectRoot, abs)}`);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.isFile()) files.push({ path: path.relative(projectRoot, abs), content: await fs.readFile(abs) });
      else throw new Error(`迁移快照包含不支持的文件：${path.relative(projectRoot, abs)}`);
    }
  }
  await walk(projectRoot);
  return { files };
}

export async function restoreMigrationBatch(projectRoot, batch) {
  const root = path.resolve(projectRoot);
  const destination = (name) => {
    const abs = path.resolve(root, name);
    if (abs === root || !abs.startsWith(root + path.sep)) throw new Error('恢复路径越界');
    return abs;
  };
  for (const file of [...batch.files, ...(batch.after || [])]) {
    const abs = destination(file.path);
    let current = root;
    for (const part of path.relative(root, abs).split(path.sep)) {
      current = path.join(current, part);
      try {
        if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`恢复路径包含符号链接：${file.path}`);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  if (!Array.isArray(batch.after)) throw new Error('缺少迁移后置快照，拒绝自动恢复');
  const before = new Map(batch.files.map(file => [file.path, file]));
  const after = new Map(batch.after.map(file => [file.path, file]));
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(name => !before.has(name) || !after.has(name) || !Buffer.from(before.get(name).content).equals(Buffer.from(after.get(name).content)));
  // Preflight every touched file before restoring anything; later user changes need a decision.
  for (const name of changed) {
    let bytes;
    try { bytes = await fs.readFile(destination(name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const expected = after.get(name);
    if (expected ? !bytes || !bytes.equals(Buffer.from(expected.content)) : bytes !== undefined) {
      throw new Error(`恢复冲突，文件已变化：${name}`);
    }
  }
  const removed = [];
  for (const name of changed) {
    const abs = destination(name);
    const original = before.get(name);
    if (original) {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, original.content);
    } else {
      await fs.unlink(abs);
      removed.push(name);
    }
  }
  return { outcome: 'restored', files: changed.length - removed.length, removed };
}

export async function migrateSuite(projectRoot, options = {}) {
  if (!options.batch) return migrateSuiteImpl(projectRoot, options);
  try {
    return await migrateSuiteImpl(projectRoot, options);
  } finally {
    // Capture partial writes on failure too; never leave a stale successful snapshot.
    delete options.batch.after;
    options.batch.after = (await expandMigrationBatch(path.resolve(projectRoot))).files;
  }
}

async function migrateSuiteImpl(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const version = options.version || await readSuiteVersion(options.versionFile);
  const slices = await listSliceDirs(root);
  const ledger = await readMigrationLedger(root);
  let inferred = ledger?.suite_to
    ? { version: ledger.suite_to, source: 'ledger' }
    : await inferMigrationSource(root, slices);
  if (!inferred.version && options.from) {
    inferred = { version: options.from, source: 'flag:--from' };
  }
  if (!inferred.version) {
    const error = new Error([
      '无法推断起始套件版本（没有迁移账本、章程托管 suite 块，也没有旧 sidecar 线索）。',
      '请人工确认后用 --from vX.Y.Z 指定起点重跑；不要猜。',
    ].join('\n'));
    error.code = 'MIGRATION_SOURCE_UNKNOWN';
    throw error;
  }
  if (inferred.version && compareVersions(version, inferred.version) < 0) {
    throw new Error(`目标套件版本低于项目已记录版本：${version} < ${inferred.version}`);
  }

  // 旧版形状迁移始终幂等执行；版本账只记录有明确版本边界的破坏性迁移。
  const sliceResults = [];
  for (const slice of slices) {
    const state = await migrateWorkflowState(slice);
    const prototype = await migratePrototypeBacklink(slice);
    const board = options.board === false ? { action: 'skipped' } : await migrateBoardSlice(slice);
    sliceResults.push({ slice, state, prototype, board });
  }

  const stepResults = [];
  let pendingHuman = null;
  const appliedRecords = Array.isArray(ledger?.applied)
    ? ledger.applied
      .map((item) => (typeof item === 'string' ? { id: item } : item))
      .filter((item) => item?.id)
    : [];
  const applied = new Set(appliedRecords.map((item) => item.id));
  const canRunVersioned = Boolean(inferred.version);
  if (canRunVersioned) {
    for (const migration of await loadVersionedMigrations()) {
      if (applied.has(migration.id)) continue;
      if (compareVersions(version, migration.target) < 0) continue;
      if (compareVersions(inferred.version, migration.target) >= 0) continue;
      const result = await migration.apply(root, { slices, sliceResults });
      stepResults.push({ id: migration.id, ...result });
      if (result.action === 'needs-human') {
        // 问人的一步：停在这里，不记账；已跑过的步骤靠幂等在重跑时补账。
        pendingHuman = { id: migration.id, result };
        break;
      }
      applied.add(migration.id);
      appliedRecords.push({ id: migration.id, at: new Date().toISOString() });
    }
  }

  // 停在问人步时不刷章程：版本锚留在原处，重跑才能重新推断出同一起点。
  const charter = pendingHuman
    ? { action: 'skipped' }
    : await refreshManagedCharter(root, options);
  let ledgerResult = null;
  if (pendingHuman) {
    // 停在问人步：不推进账本；已有旧账原样保留。
    ledgerResult = ledger ? { action: 'blocked', file: ledger.file, pending: pendingHuman.id } : null;
  } else if (canRunVersioned) {
    const ledgerValue = {
      suite_from: ledger?.suite_from || inferred.version,
      suite_to: version,
      applied: appliedRecords,
    };
    ledgerResult = {
      action: ledger?.suite_to === version && stepResults.length === 0 ? 'kept' : 'written',
      file: await writeMigrationLedger(root, ledgerValue),
      suite_from: ledgerValue.suite_from,
      suite_to: ledgerValue.suite_to,
    };
  }
  return {
    root,
    version,
    charter,
    slices: sliceResults,
    migrations: stepResults,
    migration_source: inferred,
    migration_ledger: ledgerResult,
    needs_human: pendingHuman ? { id: pendingHuman.id, ...pendingHuman.result } : null,
  };
}

function usage() {
  return '用法：node migrate_suite.mjs [project-or-slice-dir] [--from vX.Y.Z] [--no-board]';
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  let from;
  const remaining = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--from') {
      from = argv[i + 1];
      i += 1;
      continue;
    }
    remaining.push(argv[i]);
  }
  const target = remaining.find((arg) => !arg.startsWith('--')) || process.cwd();
  let result;
  try {
    result = await migrateSuite(target, { from, board: !argv.includes('--no-board') });
  } catch (error) {
    if (error?.code === 'MIGRATION_SOURCE_UNKNOWN') {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    throw error;
  }
  process.stdout.write(`suite ${result.version}：${result.root}\n`);
  process.stdout.write(`charter ${result.charter.action}${result.charter.file ? ` ${result.charter.file}` : ''}\n`);
  for (const item of result.slices) {
    process.stdout.write(`slice ${item.slice}；state=${item.state.action}；prototype=${item.prototype.action}；board=${item.board.action}\n`);
  }
  for (const migration of result.migrations) {
    process.stdout.write(`migration ${migration.id}；action=${migration.action}\n`);
  }
  if (result.needs_human) {
    process.stdout.write(`migration ${result.needs_human.id} 停在人工裁决：\n`);
    for (const item of result.needs_human.candidates) {
      process.stdout.write(`  未绑定 ${item.slice}；标题：${item.title}\n`);
    }
    process.stdout.write(`${result.needs_human.question}\n`);
    return 2;
  }
  if (result.migration_ledger) {
    process.stdout.write(`ledger ${result.migration_ledger.action} ${result.migration_ledger.file}\n`);
  }
  if (!result.slices.length) process.stdout.write('未找到工作流切片；只检查项目章程。\n');
  return 0;
}

const isMain = process.argv[1] && (() => {
  // Compare real paths so directory aliases such as /tmp → /private/tmp still launch the CLI.
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
})();
if (isMain) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

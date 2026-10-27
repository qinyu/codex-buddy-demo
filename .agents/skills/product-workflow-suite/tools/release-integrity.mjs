#!/usr/bin/env node
/**
 * 现场安装夹的版本记录与 SHA-256 校验。
 *
 * 生成（打包时）：
 *   node product-workflow-suite/tools/release-integrity.mjs generate --root <staging/product-workflow-suite>
 *
 * 核对（安装后）：
 *   node product-workflow-suite/tools/release-integrity.mjs verify
 *   node product-workflow-suite/tools/release-integrity.mjs verify --root <installed-dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MANIFEST_NAME = 'SHA256SUMS.txt';
const RECORD_NAME = 'RELEASE.json';
const VERSION_NAME = 'VERSION';

const SKIP_NAMES = new Set([
  '.DS_Store',
  MANIFEST_NAME,
  RECORD_NAME,
]);

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'coverage',
  'tests',
  'sandbox',
]);

const SOURCE_SHA1 = /^[0-9a-f]{40}$/;
const SUITE_LINE = /^(product-workflow|haitian-pw)-(\d+\.\d+\.\d+)$/;

function suiteIdentity(version) {
  const match = SUITE_LINE.exec(version || '');
  return match ? { suite: match[1], semver: match[2] } : null;
}

function usage() {
  return `用法：
  node product-workflow-suite/tools/release-integrity.mjs generate --root <dir>
  node product-workflow-suite/tools/release-integrity.mjs verify [--root <dir>] [--expected-version product-workflow-x.y.z]

核对通过退出 0；版本不符、缺文件、多余文件、哈希变化退出 1。`;
}

function parseArgs(argv) {
  const args = { command: '', root: '', expectedVersion: '' };
  const rest = [...argv];
  args.command = rest.shift() || '';
  while (rest.length) {
    const token = rest.shift();
    if (token === '--root') args.root = rest.shift() || '';
    else if (token === '--expected-version') args.expectedVersion = rest.shift() || '';
    else if (token === '--help' || token === '-h') args.command = 'help';
    else throw new Error(`未知参数：${token}\n${usage()}`);
  }
  return args;
}

function posixRel(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name) || name.startsWith('99-内部');
}

function listFiles(root) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_NAMES.has(entry.name)) continue;
      out.push(posixRel(root, abs));
    }
  }
  walk(root);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function sha256File(abs) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(abs));
  return hash.digest('hex');
}

function parseVersionFile(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const version = lines[0] || '';
  const fields = { version };
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

function parseManifest(text) {
  const files = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw new Error(`无法解析校验清单行：${line}`);
    files.push({ sha256: match[1], path: match[2] });
  }
  return files;
}

function writeAtomic(abs, content) {
  const tmp = `${abs}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, abs);
}

function generate(root) {
  const versionPath = path.join(root, VERSION_NAME);
  if (!fs.existsSync(versionPath)) {
    throw new Error(`缺少 ${VERSION_NAME}：${versionPath}`);
  }
  const versionFields = parseVersionFile(fs.readFileSync(versionPath, 'utf8'));
  const identity = suiteIdentity(versionFields.version);
  if (!identity) {
    throw new Error(`VERSION 首行不是 product-workflow-x.y.z 或旧 haitian-pw-x.y.z：${versionFields.version}`);
  }
  const files = listFiles(root);
  if (!files.includes(VERSION_NAME)) {
    throw new Error('校验清单必须包含 VERSION');
  }
  const entries = files.map((rel) => ({
    path: rel,
    sha256: sha256File(path.join(root, rel)),
    bytes: fs.statSync(path.join(root, rel)).size,
  }));
  const manifest = [
    `# ${identity.suite} release checksums`,
    `# version ${versionFields.version}`,
    `# sha256  path`,
    ...entries.map((item) => `${item.sha256}  ${item.path}`),
    '',
  ].join('\n');
  const record = {
    suite: identity.suite,
    issuer: 'Limix',
    version: versionFields.version,
    released_at: versionFields.released_at || '',
    base: versionFields.base || '',
    note: versionFields.note || '',
    algorithm: 'SHA-256',
    file_count: entries.length,
    generated_at: new Date().toISOString(),
    files: entries,
  };
  // Absent snapshot stays compatible with old packages. A present marker is strict.
  if (Object.hasOwn(versionFields, 'snapshot')) {
    assertSnapshotSource(versionFields);
    record.snapshot = versionFields.snapshot;
    record.source = versionFields.source;
  }
  writeAtomic(path.join(root, MANIFEST_NAME), manifest);
  writeAtomic(path.join(root, RECORD_NAME), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

function verify(root, expectedVersion) {
  const versionPath = path.join(root, VERSION_NAME);
  const manifestPath = path.join(root, MANIFEST_NAME);
  const recordPath = path.join(root, RECORD_NAME);
  for (const required of [versionPath, manifestPath, recordPath]) {
    if (!fs.existsSync(required)) {
      throw new Error(`安装夹缺少校验文件：${path.basename(required)}`);
    }
  }
  const versionFields = parseVersionFile(fs.readFileSync(versionPath, 'utf8'));
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  const identity = suiteIdentity(versionFields.version);
  if (!identity || record.suite !== identity.suite || record.issuer !== 'Limix') {
    throw new Error('RELEASE.json 不是 Limix product-workflow 或旧 haitian-pw 发布记录');
  }
  if (record.algorithm !== 'SHA-256') {
    throw new Error(`不支持的校验算法：${record.algorithm}`);
  }
  if (record.version !== versionFields.version) {
    throw new Error(`VERSION（${versionFields.version}）与 RELEASE.json（${record.version}）不一致`);
  }
  if (Object.hasOwn(versionFields, 'snapshot') || Object.hasOwn(record, 'snapshot')) {
    assertSnapshotSource(versionFields);
    assertSnapshotSource(record);
    if (record.snapshot !== versionFields.snapshot) {
      throw new Error(`VERSION snapshot（${versionFields.snapshot || ''}）与 RELEASE.json（${record.snapshot || ''}）不一致`);
    }
    if (record.source !== versionFields.source) {
      throw new Error(`VERSION source（${versionFields.source || ''}）与 RELEASE.json（${record.source || ''}）不一致`);
    }
  }
  if (expectedVersion && expectedVersion !== record.version) {
    throw new Error(`期望版本 ${expectedVersion}，实际 ${record.version}`);
  }
  const manifestMap = new Map(manifest.map((item) => [item.path, item.sha256]));
  const recordMap = new Map(record.files.map((item) => [item.path, item.sha256]));
  if (manifestMap.size !== recordMap.size) {
    throw new Error('SHA256SUMS.txt 与 RELEASE.json 文件数不一致');
  }
  for (const [rel, hash] of manifestMap) {
    if (recordMap.get(rel) !== hash) {
      throw new Error(`清单与发布记录哈希不一致：${rel}`);
    }
  }
  const actual = new Set(listFiles(root));
  const expected = new Set(manifestMap.keys());
  const missing = [...expected].filter((rel) => !actual.has(rel));
  const extra = [...actual].filter((rel) => !expected.has(rel));
  const changed = [];
  for (const rel of expected) {
    if (!actual.has(rel)) continue;
    const hash = sha256File(path.join(root, rel));
    if (hash !== manifestMap.get(rel)) changed.push(rel);
  }
  if (missing.length || extra.length || changed.length) {
    const lines = ['安装夹与发布记录不一致'];
    if (missing.length) lines.push(`缺文件：${missing.join(', ')}`);
    if (extra.length) lines.push(`多文件：${extra.join(', ')}`);
    if (changed.length) lines.push(`已改文件：${changed.join(', ')}`);
    throw new Error(lines.join('\n'));
  }
  return {
    ok: true,
    version: record.version,
    issuer: record.issuer,
    file_count: record.file_count,
    root,
  };
}

function assertSnapshotSource(fields) {
  if (fields.snapshot !== 'snapshot-test') {
    throw new Error(`snapshot 必须是 snapshot-test：${fields.snapshot || ''}`);
  }
  if (!SOURCE_SHA1.test(fields.source || '')) {
    throw new Error(`snapshot source 必须是完整 40 位 SHA1：${fields.source || ''}`);
  }
}

function resolveRoot(rawRoot) {
  if (rawRoot) return path.resolve(rawRoot);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..');
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.command === 'help' || !args.command) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const root = resolveRoot(args.root);
  if (args.command === 'generate') {
    if (!args.root) throw new Error('generate 必须传 --root');
    const record = generate(root);
    process.stdout.write(`generated ${record.version} ${record.file_count} files\n`);
    return 0;
  }
  if (args.command === 'verify') {
    const result = verify(root, args.expectedVersion);
    process.stdout.write(
      `ok ${result.version} issuer=${result.issuer} files=${result.file_count} root=${result.root}\n`,
    );
    return 0;
  }
  throw new Error(`未知命令：${args.command}\n${usage()}`);
}

const isDirectRun = process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url));
if (isDirectRun) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  }
}

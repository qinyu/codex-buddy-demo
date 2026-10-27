#!/usr/bin/env node
/**
 * 从 git tag 或指定提交打出现场安装 zip，并写入 VERSION / RELEASE.json / SHA256SUMS.txt。
 *
 *   node product-workflow-suite/tools/pack-release.mjs --tag product-workflow-0.4.0 --out /path/to/product-workflow-suite-v0.4.0-YYYYMMDD.zip
 *   node product-workflow-suite/tools/pack-release.mjs --snapshot --commit <sha> --version product-workflow-x.y.z --out product-workflow-v0.9.3-snapshot-test-<sha12>.zip
 *
 * snapshot 不是正式发布：不要求 tag，只归档该提交，并在包内标明 snapshot-test。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main as integrityMain } from './release-integrity.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
  return `用法：
  node product-workflow-suite/tools/pack-release.mjs --tag product-workflow-x.y.z --out <zip-path>
  node product-workflow-suite/tools/pack-release.mjs --snapshot --commit <sha> --version product-workflow-x.y.z --out <name 含版本、snapshot-test 与 SHA 前 12 位>.zip

snapshot 默认冻结 HEAD 的完整 SHA，不打 tag，不读工作区脏文件或 ignored 文件。--version 必须与该提交的 VERSION 一致。输出名必须带版本、snapshot-test 和 SHA 前 12 位，不必唯一。旧 haitian-pw 包仍可校验，新 tag 只接受 product-workflow。`;
}

const VALUE_FLAGS = new Set(['--tag', '--out', '--commit', '--version']);

export function parseArgs(argv) {
  const args = { snapshot: false };
  const rest = [...argv];
  while (rest.length) {
    const token = rest.shift();
    if (VALUE_FLAGS.has(token)) {
      const key = token.slice(2);
      if (Object.hasOwn(args, key)) throw new Error(`重复参数：${token}\n${usage()}`);
      args[key] = take(rest, token);
    } else if (token === '--snapshot') {
      if (args.snapshot) throw new Error(`重复参数：${token}\n${usage()}`);
      args.snapshot = true;
    } else if (token === '--help' || token === '-h') {
      if (args.help) throw new Error(`重复参数：${token}\n${usage()}`);
      args.help = true;
    } else throw new Error(`未知参数：${token}\n${usage()}`);
  }
  return args;
}

function take(rest, token) {
  const value = rest.shift();
  if (!value || value.startsWith('-')) throw new Error(`缺少参数：${token}\n${usage()}`);
  return value;
}

function run(cmd, cmdArgs, cwd = ROOT) {
  const result = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} 失败\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function copyTree(src, dest, skipTopNames) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (['__MACOSX', '.DS_Store', '.venv', '__pycache__'].includes(entry.name)) continue;
    if (skipTopNames && skipTopNames.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to, null);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

// Shared by the release path and isolated closure tests; does not create a ZIP or publish.
function stageTreeCore(extract, suite) {
  if (fs.existsSync(suite)) throw new Error(`分发目标已存在：${suite}`);
  // 新布局：仓库内 product-workflow-suite/ 即交付内容本体，直接收进包；
  // evals（含 sandbox）是开发侧评估与夹具，不进现场包。
  const srcSuite = path.join(extract, 'product-workflow-suite');
  if (!fs.existsSync(srcSuite)) throw new Error(`源树缺少 product-workflow-suite/：${extract}`);
  copyTree(srcSuite, suite, new Set(['evals']));
  // docs/ 整目录不进包（维护者文档），但 docs/adr 是定稿决策，00-本版说明引用它，随包带走。
  if (fs.existsSync(path.join(extract, 'docs', 'adr'))) {
    fs.mkdirSync(path.join(suite, 'docs', 'adr'), { recursive: true });
    for (const f of fs.readdirSync(path.join(extract, 'docs', 'adr'))) {
      fs.copyFileSync(path.join(extract, 'docs', 'adr', f), path.join(suite, 'docs', 'adr', f));
    }
  }
  return suite;
}

// 主干发版入口：暂存后生成 integrity 清单并校验。
export function stageReleaseTree(extract, suite) {
  const staged = stageTreeCore(extract, suite);
  integrityMain(['generate', '--root', staged]);
  return staged;
}

const VERSION_LINE = /^product-workflow-\d+\.\d+\.\d+$/;

function archiveCommit(treeish, staging, repo = ROOT) {
  const extract = path.join(staging, 'extract');
  fs.mkdirSync(extract);
  const tarPath = path.join(staging, 'src.tar');
  run('git', ['archive', '--format=tar', '-o', tarPath, treeish], repo);
  run('tar', ['-xf', tarPath, '-C', extract]);
  return extract;
}

function publishZip(staging, outPath) {
  const zipAbs = path.resolve(outPath);
  if (fs.existsSync(zipAbs)) throw new Error(`目标已存在：${zipAbs}`);
  const packed = path.join(staging, path.basename(zipAbs));
  run('zip', ['-qr', packed, 'product-workflow-suite'], staging);
  try {
    fs.linkSync(packed, zipAbs);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`目标已存在：${zipAbs}`);
    const kept = fs.existsSync(zipAbs) ? `；已保留目标：${zipAbs}` : '';
    throw new Error(`无法同卷硬链接发布：${zipAbs}${kept}`);
  }
  return zipAbs;
}

function stagingDir(outPath, prefix) {
  const parent = path.dirname(path.resolve(outPath));
  fs.mkdirSync(parent, { recursive: true });
  return fs.mkdtempSync(path.join(parent, prefix));
}

function pack(tag, outPath) {
  if (!VERSION_LINE.test(tag)) throw new Error(`tag 必须是 product-workflow-x.y.z：${tag}`);
  const zipAbs = path.resolve(outPath);
  if (fs.existsSync(zipAbs)) throw new Error(`目标已存在：${zipAbs}`);
  const staging = stagingDir(outPath, '.product-workflow-pack-');
  try {
    const extract = archiveCommit(tag, staging);
    const suite = path.join(staging, 'product-workflow-suite');
    stageReleaseTree(extract, suite);
    return publishZip(staging, outPath);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function markSnapshot(extract, commit, version) {
  const versionPath = path.join(extract, 'product-workflow-suite', 'VERSION');
  if (!fs.existsSync(versionPath)) throw new Error(`提交缺少 VERSION：${commit}`);
  const lines = fs.readFileSync(versionPath, 'utf8').split(/\r?\n/);
  const recorded = (lines[0] || '').trim();
  if (recorded !== version) {
    throw new Error(`--version ${version} 与提交 VERSION ${recorded || '(空)'} 不一致`);
  }
  const body = lines.slice(1).filter((line) => {
    const key = line.slice(0, line.indexOf(':')).trim();
    return key !== 'snapshot' && key !== 'source';
  });
  while (body.length && body[body.length - 1] === '') body.pop();
  const text = [recorded, ...body, `snapshot: snapshot-test`, `source: ${commit}`, ''].join('\n');
  fs.writeFileSync(versionPath, text);
}

function snapshotOutName(out, version, commit) {
  const base = path.basename(out);
  if (!base.endsWith('.zip')) throw new Error(`输出必须是 .zip：${out}`);
  const stem = base.slice(0, -4);
  const short = commit.slice(0, 12);
  const tokens = stem.split('-').filter(Boolean);
  const hasMarker = tokens.some((token, index) => token === 'snapshot' && tokens[index + 1] === 'test');
  if (!hasMarker || !tokens.includes(short)) {
    throw new Error(`snapshot 输出名必须含 snapshot-test 和提交前 12 位，避免冒充正式包：${base}`);
  }
  const semver = version.slice('product-workflow-'.length);
  if (!tokens.includes(semver) && !tokens.includes(`v${semver}`)) {
    throw new Error(`snapshot 输出名必须含版本 ${semver}：${base}`);
  }
  return base;
}

export function packSnapshot({ commit = 'HEAD', version, out, repo = ROOT } = {}) {
  if (!VERSION_LINE.test(version || '')) throw new Error(`--version 必须是 product-workflow-x.y.z：${version || ''}`);
  if (!out) throw new Error(usage());
  const resolved = run('git', ['rev-parse', '--verify', '--end-of-options', `${commit}^{commit}`], repo).trim();
  snapshotOutName(out, version, resolved);
  const zipAbs = path.resolve(out);
  if (fs.existsSync(zipAbs)) throw new Error(`目标已存在：${zipAbs}`);
  const staging = stagingDir(out, '.product-workflow-snapshot-');
  try {
    const extract = archiveCommit(resolved, staging, repo);
    markSnapshot(extract, resolved, version);
    const suite = path.join(staging, 'product-workflow-suite');
    stageReleaseTree(extract, suite);
    const versionText = fs.readFileSync(path.join(suite, 'VERSION'), 'utf8');
    if (!versionText.includes(`source: ${resolved}`) || !versionText.includes('snapshot: snapshot-test')) {
      throw new Error('snapshot 标识未进入发布树');
    }
    const zip = publishZip(staging, out);
    return { path: zip, version, commit: resolved, snapshot: 'snapshot-test' };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

// Setup/Wiki 分发入口：只做目录暂存，不跑 integrity generate（调用方自带校验时机）。
export function stageSuite(extract, suite) {
  return stageTreeCore(extract, suite);
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (args.snapshot) {
    if (args.tag) throw new Error(`snapshot 与 --tag 不能同时使用\n${usage()}`);
    if (!args.version || !args.out) throw new Error(usage());
    const packed = packSnapshot({ commit: args.commit || 'HEAD', version: args.version, out: args.out });
    process.stdout.write(`packed ${packed.path}\nversion=${packed.version}\nsnapshot=${packed.snapshot}\nsource=${packed.commit}\n`);
    return 0;
  }
  if (args.commit || args.version) throw new Error(`--commit/--version 只用于 --snapshot\n${usage()}`);
  if (!args.tag || !args.out) throw new Error(usage());
  const zip = pack(args.tag, args.out);
  process.stdout.write(`packed ${zip}\n`);
  return 0;
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  }
}

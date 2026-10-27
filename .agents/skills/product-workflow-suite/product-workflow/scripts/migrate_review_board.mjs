#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const renderScript = path.join(scriptDir, 'render_review_board.mjs');
const BOARD_DIR = '.review-board';
const LEGACY_NAMES = [
  'index.html',
  'index.prev.html',
  'review-board.js',
  'review-board-live.js',
  'mermaid.min.js',
];
const BOARD_SIDECARS = ['review-board.js', 'review-board-live.js', 'mermaid.min.js'];
const externalScriptPattern = () => /<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/)?(?:mermaid\.min|review-board(?:-live)?)\.js(?:\?[^"']*)?["'][^>]*>(?:\s*<\/script\s*>)?/gi;
const boardScriptHintPattern = () => /<script\b[^>]*\bsrc\s*=\s*(?:["'][^"']*(?:mermaid\.min|review-board(?:-live)?\.js)[^"']*["']|[^\s>]*(?:mermaid\.min|review-board(?:-live)?\.js)[^\s>]*)[^>]*>(?:\s*<\/script\s*>)?/gi;

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function isSliceDir(dir) {
  if (await pathExists(path.join(dir, '.workflow-state.json'))) return true;
  const markers = ['clarify.md', 'prd.md', 'project-wiki.md', 'development-plan.md'];
  for (const name of markers) {
    if (await pathExists(path.join(dir, name))) return true;
  }
  return false;
}

export async function listSliceDirs(root) {
  const resolved = path.resolve(root);
  const slices = [];
  if (await isSliceDir(resolved)) slices.push(resolved);
  const candidates = [
    path.join(resolved, 'docs', 'product-development'),
    path.join(resolved, 'product-development'),
  ];
  for (const parent of candidates) {
    let entries = [];
    try {
      entries = await fs.readdir(parent, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(parent, entry.name);
      if (await isSliceDir(dir)) slices.push(dir);
    }
  }
  return [...new Set(slices)];
}

async function moveLegacyBoardFiles(slice) {
  const moved = [];
  const destRoot = path.join(slice, BOARD_DIR, 'legacy');
  for (const name of LEGACY_NAMES) {
    const from = path.join(slice, name);
    if (!(await pathExists(from))) continue;
    await fs.mkdir(destRoot, { recursive: true });
    const preferred = path.join(destRoot, name);
    const to = await pathExists(preferred)
      ? path.join(destRoot, `root-${name}`)
      : preferred;
    if (await pathExists(to)) throw new Error(`遗留看板目标已存在，停止覆盖：${to}`);
    await fs.rename(from, to);
    moved.push(name);
  }
  const historyFrom = path.join(slice, 'history');
  if (await pathExists(historyFrom)) {
    await fs.mkdir(destRoot, { recursive: true });
    const historyTo = path.join(destRoot, 'history');
    if (await pathExists(historyTo)) throw new Error(`遗留看板目标已存在，停止覆盖：${historyTo}`);
    await fs.rename(historyFrom, historyTo);
    moved.push('history/');
  }
  return moved;
}

async function assertNoRendererRelocationConflicts(slice) {
  const destRoot = path.join(slice, BOARD_DIR, 'legacy');
  for (const name of LEGACY_NAMES) {
    const source = path.join(slice, name);
    const destination = path.join(destRoot, name);
    if (await pathExists(source) && await pathExists(destination)) {
      throw new Error(`遗留看板目标已存在，停止覆盖：${destination}`);
    }
  }
  const historySource = path.join(slice, 'history');
  const historyDestination = path.join(destRoot, 'history');
  if (await pathExists(historySource) && await pathExists(historyDestination)) {
    throw new Error(`遗留看板目标已存在，停止覆盖：${historyDestination}`);
  }
}

function renderSlice(slice) {
  const result = spawnSync(process.execPath, [renderScript, slice], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `render failed (${result.status})`).trim());
  }
}

async function htmlReferencesExternalBoardScript(file) {
  if (!(await pathExists(file))) return false;
  const html = await fs.readFile(file, 'utf8');
  externalScriptPattern().lastIndex = 0;
  return externalScriptPattern().test(html);
}

async function boardNeedsInline(slice) {
  const boardRoot = path.join(slice, BOARD_DIR);
  const board = path.join(boardRoot, 'index.html');
  if (!(await pathExists(board))) return true;
  if (await htmlReferencesExternalBoardScript(board)) return true;
  if (boardScriptHintPattern().test(await fs.readFile(board, 'utf8'))) return true;
  for (const name of BOARD_SIDECARS) {
    if (await pathExists(path.join(boardRoot, name))) return true;
  }
  return false;
}

async function removeBoardSidecars(slice) {
  const removed = [];
  const boardRoot = path.join(slice, BOARD_DIR);
  for (const name of BOARD_SIDECARS) {
    const file = path.join(boardRoot, name);
    if (!(await pathExists(file))) continue;
    await fs.rm(file, { force: true });
    removed.push(name);
  }
  return removed;
}

const escapeInlineScript = (source) => String(source).replace(/<\/script(?=[\s/>])/gi, '<\\/script');

function referencedSidecar(tag) {
  const name = tag.match(/(?:\.\/)?(mermaid\.min|review-board(?:-live)?)\.js/i)?.[1];
  return name ? `${name.toLowerCase()}.js` : '';
}

async function inlineExistingBoard(slice) {
  const board = path.join(slice, BOARD_DIR, 'index.html');
  const html = await fs.readFile(board, 'utf8');
  const tags = [...html.matchAll(externalScriptPattern())].map((match) => match[0]);
  const unmatchedHints = [...html.matchAll(boardScriptHintPattern())]
    .filter((match) => {
      const matchedBoardScript = match[0].match(/\bsrc\s*=\s*["'](?:\.\/)?(mermaid\.min|review-board(?:-live)?)\.js(?:\?[^"']*)?["']/i);
      return !matchedBoardScript || !match[0].includes('>');
    });
  if (unmatchedHints.length) {
    throw new Error('发现未支持的看板脚本引用格式，已保留原 HTML、快照和旁路文件');
  }
  const needed = [...new Set(tags.map(referencedSidecar).filter(Boolean))];
  const sources = new Map();
  const missing = [];
  for (const name of needed) {
    const file = path.join(slice, BOARD_DIR, name);
    if (await pathExists(file)) {
      sources.set(name, await fs.readFile(file, 'utf8'));
      continue;
    }
    const bundled = path.join(scriptDir, 'assets', name);
    if (await pathExists(bundled)) {
      sources.set(name, await fs.readFile(bundled, 'utf8'));
      continue;
    }
    missing.push(name);
  }
  const legacyDir = path.join(slice, BOARD_DIR, 'legacy');
  await fs.mkdir(legacyDir, { recursive: true });
  const legacyBoard = path.join(legacyDir, 'index.html');
  const existingSnapshot = await pathExists(legacyBoard) ? await fs.readFile(legacyBoard) : null;
  const currentBoard = await fs.readFile(board);
  const boardSnapshot = existingSnapshot && !existingSnapshot.equals(currentBoard)
    ? path.join(legacyDir, 'review-board-index.html')
    : legacyBoard;
  if (await pathExists(boardSnapshot)) {
    const existing = await fs.readFile(boardSnapshot);
    if (!existing.equals(currentBoard)) throw new Error(`看板快照目标已存在，停止覆盖：${boardSnapshot}`);
  } else {
    await fs.copyFile(board, boardSnapshot);
  }
  const missingInteractiveDataBoard = missing.length === 1
    && missing[0] === 'review-board-live.js'
    && !html.includes('window.__BOARD_DATA__')
    && await pathExists(path.join(scriptDir, 'assets', 'review-board-live.js'));
  const missingBakedWithLive = missing.length === 1
    && missing[0] === 'review-board.js'
    && needed.includes('review-board-live.js')
    && !await pathExists(path.join(slice, BOARD_DIR, 'review-board-live.js'))
    && await pathExists(path.join(scriptDir, 'assets', 'review-board-live.js'));
  const canRebuildWithBundledLive = missingInteractiveDataBoard || missingBakedWithLive;
  if (missing.length && !canRebuildWithBundledLive) {
    throw new Error(`缺少旁路脚本，已保留 .review-board/index.html 与 legacy/index.html：${missing.join(', ')}`);
  }
  const usesBundledLive = needed.includes('review-board-live.js')
    && !(await pathExists(path.join(slice, BOARD_DIR, 'review-board-live.js')));
  if (canRebuildWithBundledLive || (usesBundledLive && !html.includes('window.__BOARD_DATA__'))) {
    const stagingSnapshot = path.join(slice, BOARD_DIR, `legacy-board-${process.pid}-${Date.now()}.tmp`);
    const preservedLegacy = boardSnapshot;
    await fs.copyFile(board, stagingSnapshot);
    try {
      renderSlice(slice);
      await fs.copyFile(stagingSnapshot, preservedLegacy);
      await fs.rm(stagingSnapshot, { force: true });
      return needed;
    } catch (error) {
      await fs.copyFile(stagingSnapshot, board);
      await fs.rm(stagingSnapshot, { force: true });
      throw error;
    }
  }
  const inlined = html.replace(externalScriptPattern(), (tag) => {
    const source = sources.get(referencedSidecar(tag));
    return source == null ? tag : `<script>${escapeInlineScript(source)}</script>`;
  });
  await fs.writeFile(board, inlined);
  for (const name of needed) await fs.rm(path.join(slice, BOARD_DIR, name), { force: true });
  return needed;
}

export async function migrateSlice(slice) {
  const root = path.resolve(slice);
  const board = path.join(root, BOARD_DIR, 'index.html');
  const hadBoard = await pathExists(board);
  const splitBoard = await boardNeedsInline(root);
  const rootShells = [];
  for (const name of LEGACY_NAMES) {
    if (await pathExists(path.join(root, name))) rootShells.push(name);
  }
  if (await pathExists(path.join(root, 'history'))) rootShells.push('history/');
  if (rootShells.length) await assertNoRendererRelocationConflicts(root);
  const inlined = splitBoard && hadBoard ? await inlineExistingBoard(root) : [];
  const copied = rootShells.length ? await moveLegacyBoardFiles(root) : [];
  if (!inlined.length && (!hadBoard || rootShells.length || splitBoard)) renderSlice(root);
  const moved = [];
  if (await pathExists(board)) {
    for (const name of copied) {
      await fs.rm(path.join(root, name), { force: true });
      moved.push(name);
    }
  }
  const removed = inlined.length ? inlined : await removeBoardSidecars(root);
  const generated = await pathExists(board);
  return {
    slice: root,
    generated,
    moved,
    removed,
    action: hadBoard && !moved.length && !splitBoard ? 'kept' : 'migrated',
  };
}

export async function migrateProject(root) {
  const slices = await listSliceDirs(root);
  const results = [];
  for (const slice of slices) {
    results.push(await migrateSlice(slice));
  }
  return results;
}

function usage() {
  return '用法：node migrate_review_board.mjs [project-or-slice-dir]';
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const target = argv.find((arg) => !arg.startsWith('--')) || process.cwd();
  const results = await migrateProject(target);
  if (!results.length) {
    process.stdout.write(`未找到工作流切片：${path.resolve(target)}\n`);
    return 0;
  }
  for (const item of results) {
    const moved = item.moved.length ? `；迁走 ${item.moved.join(', ')}` : '';
    process.stdout.write(`${item.action} ${item.slice}${moved}\n`);
  }
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

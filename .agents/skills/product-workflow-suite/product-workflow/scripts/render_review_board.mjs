#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const restoreIdx = argv.indexOf('--restore');
const restoreTarget = restoreIdx >= 0 ? argv[restoreIdx + 1] : null;
const dir = argv.find((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--restore');
if (!dir || (restoreIdx >= 0 && !restoreTarget)) {
  console.error('用法：node render_review_board.mjs <dir> [--restore prev|<id>] [--verbose] [--bake]');
  process.exit(1);
}

const root = path.resolve(dir);
const read = async (name) => {
  try {
    return await fs.readFile(path.join(root, name), 'utf8');
  } catch {
    return '';
  }
};

const readJson = async (name) => {
  try {
    return JSON.parse(await fs.readFile(path.join(root, name), 'utf8'));
  } catch {
    return {};
  }
};

const listMarkdownFiles = async (dirname) => {
  try {
    const entries = await fs.readdir(path.join(root, dirname), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `${dirname}/${entry.name}`)
      .sort();
  } catch {
    return [];
  }
};

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const jsonForInlineScript = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const escapeInlineScript = (source) => String(source).replace(/<\/script(?=[\s/>])/gi, '<\\/script');

const inline = (value) =>
  escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

let componentCounter = 0;

const HISTORY_SOURCES = [
  'index.html',
  'prd.md',
  'prototype.html',
  'stitch-prototype.md',
  'test-cases.md',
  'automation-test-plan.md',
  'technical-solution.md',
  'development-plan.md',
  'clarify.md',
  'project-wiki.md',
  'start-implement.md',
  'develop.md',
  'review-notes.md',
];
const MAX_HISTORY = 10;
const HISTORY_DIR_RE = /^\d{8}-\d{6}$/;
const BOARD_DIR = '.review-board';
const ROOT_BOARD_SHELLS = [
  'index.html',
  'index.prev.html',
  'review-board.js',
  'review-board-live.js',
  'mermaid.min.js',
];
const BOARD_SIDECARS = ['review-board.js', 'review-board-live.js', 'mermaid.min.js'];
const externalBoardScriptPattern = () => /<script\b[^>]*\bsrc\s*=\s*["']\.\/(?:mermaid\.min|review-board(?:-live)?)\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/gi;

function localStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function listExistingSources() {
  const existing = [];
  for (const name of HISTORY_SOURCES) {
    try {
      await fs.access(path.join(root, name));
      existing.push(name);
    } catch {
      // skip
    }
  }
  return existing;
}

async function listHistoryIds() {
  try {
    const entries = await fs.readdir(path.join(root, BOARD_DIR, 'history'), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && HISTORY_DIR_RE.test(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function writeHistoryManifest(ids) {
  const historyRoot = path.join(root, BOARD_DIR, 'history');
  await fs.mkdir(historyRoot, { recursive: true });
  const latest = ids[ids.length - 1] || 'prev';
  const lines = [
    '# 工作流产物历史',
    '',
    '回上一版：`node render_review_board.mjs <本目录> --restore prev`',
    `回指定快照：\`node render_review_board.mjs <本目录> --restore ${latest}\`,`,
    '',
    ...ids.map((id) => `- \`${id}\``),
    '',
  ];
  await fs.writeFile(path.join(historyRoot, 'HISTORY.md'), `${lines.join('\n')}\n`);
}

async function snapshotHistory() {
  const existing = await listExistingSources();
  const currentBoard = path.join(root, BOARD_DIR, 'index.html');
  if (!(await pathExists(currentBoard)) && !existing.includes('index.html')) {
    return { skipped: true, reason: 'first-generation' };
  }
  const boardRoot = path.join(root, BOARD_DIR);
  await fs.mkdir(boardRoot, { recursive: true });
  if (await pathExists(currentBoard)) {
    await fs.copyFile(currentBoard, path.join(boardRoot, 'index.prev.html'));
  }
  const id = localStamp();
  const dest = path.join(boardRoot, 'history', id);
  await fs.mkdir(dest, { recursive: true });
  for (const name of existing) {
    await fs.copyFile(path.join(root, name), path.join(dest, name));
  }
  const ids = [...(await listHistoryIds()), id].filter((v, i, a) => a.indexOf(v) === i).sort();
  while (ids.length > MAX_HISTORY) {
    const old = ids.shift();
    await fs.rm(path.join(boardRoot, 'history', old), { recursive: true, force: true });
  }
  await writeHistoryManifest(ids);
  return { skipped: false, id, files: existing };
}

async function restoreHistory(target) {
  if (target === 'prev') {
    const ids = await listHistoryIds();
    if (ids.length) return restoreHistory(ids[ids.length - 1]);
    try {
      await fs.copyFile(path.join(root, BOARD_DIR, 'index.prev.html'), path.join(root, BOARD_DIR, 'index.html'));
      return { id: 'index.prev.html', files: ['.review-board/index.html'] };
    } catch {
      throw new Error('没有可回滚的历史：.review-board/history/ 为空，且不存在 index.prev.html');
    }
  }
  if (!HISTORY_DIR_RE.test(target)) {
    throw new Error(`无效快照编号：${target}（应为 YYYYMMDD-HHMMSS 或 prev）`);
  }
  const srcDir = path.join(root, BOARD_DIR, 'history', target);
  try {
    await fs.access(srcDir);
  } catch {
    throw new Error(`找不到快照 .review-board/history/${target}`);
  }
  const names = (await fs.readdir(srcDir)).filter((name) => HISTORY_SOURCES.includes(name));
  if (!names.length) throw new Error(`快照 history/${target} 是空的`);
  for (const name of names) {
    await fs.copyFile(path.join(srcDir, name), path.join(root, name));
  }
  await relocateRootBoardShells();
  return { id: target, files: names };
}

async function readBundledScript(name) {
  return fs.readFile(path.join(scriptDir, 'assets', name), 'utf8');
}

function inlineScriptTag(source) {
  return `<script>${escapeInlineScript(source)}</script>`;
}

async function inlineBoardScripts(html, scripts) {
  const bundled = {
    'mermaid.min.js': scripts.mermaid,
    'review-board-live.js': scripts.live,
    'review-board.js': scripts.baked,
  };
  return html.replace(externalBoardScriptPattern(), (tag) => {
    const name = tag.match(/\.\/(mermaid\.min|review-board(?:-live)?)\.js/i)?.[1];
    const key = name ? `${name.toLowerCase()}.js` : '';
    const source = bundled[key];
    return source == null ? tag : inlineScriptTag(source);
  });
}

async function inlineBoardAssets(html) {
  return inlineBoardScripts(html, {
    mermaid: await readBundledScript('mermaid.min.js'),
    live: await readBundledScript('review-board-live.js'),
  });
}

async function removeBoardSidecars() {
  const boardRoot = path.join(root, BOARD_DIR);
  for (const name of BOARD_SIDECARS) {
    await fs.rm(path.join(boardRoot, name), { force: true });
  }
}

async function relocateRootBoardShells() {
  const destRoot = path.join(root, BOARD_DIR, 'legacy');
  const moved = [];
  for (const name of ROOT_BOARD_SHELLS) {
    const from = path.join(root, name);
    if (!(await pathExists(from))) continue;
    await fs.mkdir(destRoot, { recursive: true });
    const to = path.join(destRoot, name);
    if (await pathExists(to)) await fs.rm(to, { recursive: true, force: true });
    await fs.rename(from, to);
    moved.push(name);
  }
  return moved;
}

const LIVE_SHELL = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>产品工作流评审看板</title>
  <style>
    :root { --ink:#17212b; --muted:#667085; --line:#d8dee8; --soft:#f5f7fa; --surface:#fff; --brand:#146b5f; --blue:#2d6cdf; --warn:#b54708; --ok:#067647; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:#eef2f6; }
    header { background:#101828; color:#fff; padding:28px 32px 20px; }
    header h1 { margin:0; font-size:28px; }
    header p, #live-banner { max-width:1120px; color:#cbd5e1; line-height:1.7; }
    #live-banner { margin:12px 32px 0; padding:10px 12px; border-radius:8px; background:#b54708; color:#fff; }
    main { max-width:1360px; margin:0 auto; padding:18px; }
    .tabs { display:flex; flex-wrap:wrap; gap:8px; position:sticky; top:0; z-index:5; padding:10px 0 14px; background:#eef2f6; }
    .tab { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:6px; padding:9px 12px; font-weight:750; cursor:pointer; }
    .tab[aria-selected="true"] { background:var(--brand); color:#fff; border-color:var(--brand); }
    .panel { display:none; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:22px; }
    .panel.active { display:block; }
    .status { display:inline-flex; border:1px solid var(--line); border-radius:999px; padding:5px 10px; font-size:13px; font-weight:750; background:var(--soft); }
    .status.reviewed { color:var(--ok); background:#ecfdf3; border-color:#98d6b3; }
    .status.draft { color:var(--warn); background:#fffaeb; border-color:#f7c98b; }
    .status.blocked { color:var(--warn); background:#fffaeb; border-color:#f7c98b; }
    .status.waived { color:#9a3412; background:#fff7ed; border-color:#fdba74; margin-left:6px; }
    .status.empty { color:var(--muted); }
    .live-hint { color:var(--muted); font-size:13px; }
    .prototype-frame { width:100%; min-height:70vh; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .view-switch { display:flex; gap:8px; margin:12px 0; }
    .view-button { border:1px solid var(--line); background:#fff; border-radius:6px; padding:7px 10px; cursor:pointer; }
    .view-button[aria-selected="true"] { background:var(--brand); color:#fff; border-color:var(--brand); }
    pre { overflow:auto; background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:14px; }
    table { width:100%; border-collapse:collapse; font-size:14px; margin:12px 0; }
    th, td { text-align:left; vertical-align:top; padding:10px; border-bottom:1px solid #edf0f4; }
    th { color:var(--muted); background:var(--soft); }
    .review-box { border-left:4px solid var(--brand); background:#eefaf6; border-radius:6px; padding:12px 14px; margin:12px 0 16px; }
  </style>
</head>
<body>
  <header>
    <h1>产品工作流评审看板</h1>
    <p>看板资源在 .review-board/。双击其中的 index.html 即可查看。Markdown 源文件仍在上一级目录。</p>
    <p id="current-stage-label">当前阶段：</p>
  </header>
  <p id="live-banner" hidden></p>
  <main data-product-title="产品工作流需求" data-default-stage="clarify">
    <nav class="tabs" aria-label="产品工作流 tabs"></nav>
  </main>
  <script src="./mermaid.min.js"></script>
  <script src="./review-board-live.js"></script>
</body>
</html>
`;

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function ensureIgnore() {
  const ignorePath = path.join(root, '.gitignore');
  const ignoreRules = ['.review-board/', 'index.html', 'index.prev.html', 'review-board.js', 'review-board-live.js', 'mermaid.min.js', 'history/', '.workflow-state.json', '.product-workflow-portal.json', '.limix-artifacts.json'];
  let ignoreText = '';
  try { ignoreText = await fs.readFile(ignorePath, 'utf8'); } catch { /* create */ }
  const missing = ignoreRules.filter((rule) => !ignoreText.split(/\r?\n/).includes(rule));
  if (missing.length) {
    const prefix = ignoreText && !ignoreText.endsWith('\n') ? '\n' : '';
    await fs.writeFile(ignorePath, `${ignoreText}${prefix}${missing.join('\n')}\n`);
  }
}

const projectWiki = await read('project-wiki.md');
const clarify = await read('clarify.md');
const prd = await read('prd.md');
const tests = await read('test-cases.md');
const automationPlan = await read('automation-test-plan.md');
const tech = await read('technical-solution.md');
const plan = await read('development-plan.md');
const startImplement = await read('start-implement.md');
const develop = await read('develop.md');
const prototype = await read('prototype.html');
const stitchPrototype = await read('stitch-prototype.md');
const prototypeExists = Boolean(prototype);
const stitchPrototypeExists = Boolean(stitchPrototype);
const workflowState = await readJson('.workflow-state.json');
if (await pathExists(path.join(root, '.workflow-state.json'))) {
  const { validateFile, formatReport } = await import('./validate_workflow_state.mjs');
  const report = await validateFile(path.join(root, '.workflow-state.json'));
  if (report.errors.length) {
    console.error(formatReport(report));
    console.error('先修 .workflow-state.json，再生成看板。');
    process.exit(1);
  }
  if (report.warnings.length && argv.includes('--verbose')) console.error(formatReport(report));
}
const repoWikiFiles = await listMarkdownFiles('repo-wikis');

async function packedBoardData() {
  const files = {
    'clarify.md': clarify,
    'project-wiki.md': projectWiki,
    'prd.md': prd,
    'prototype.html': prototype,
    'stitch-prototype.md': stitchPrototype,
    'test-cases.md': tests,
    'automation-test-plan.md': automationPlan,
    'technical-solution.md': tech,
    'development-plan.md': plan,
    'start-implement.md': startImplement,
    'develop.md': develop,
  };
  return { state: workflowState, files };
}

function staticWaiverSummary(state) {
  const waivers = Array.isArray(state?.waivers) ? state.waivers.filter((item) => item) : [];
  if (!waivers.length) return '';
  const items = waivers.map((waiver) => {
    const task = escapeHtml(waiver.task || '');
    const owner = escapeHtml(waiver.owner || '未记录');
    const stage = waiver.stage ? ` · ${escapeHtml(waiver.stage)}` : '';
    return `<li>已豁免 · 未完成 · ${task} · 责任人 ${owner}${stage}</li>`;
  }).join('');
  return `<noscript><section id="static-waivers"><h2>已豁免 · 未完成</h2><ul>${items}</ul></section></noscript>`;
}

async function liveBoardHtml(data) {
  const shell = LIVE_SHELL.replace(
    '<script src="./review-board-live.js"></script>',
    `${staticWaiverSummary(data.state)}\n  <script>window.__BOARD_DATA__=${jsonForInlineScript(data)};</script>\n  <script src="./review-board-live.js"></script>`,
  );
  return inlineBoardAssets(shell);
}

async function writeLiveBoard() {
  const verbose = argv.includes('--verbose');
  const force = argv.includes('--force');
  const boardRoot = path.join(root, BOARD_DIR);
  await fs.mkdir(boardRoot, { recursive: true });
  const indexPath = path.join(boardRoot, 'index.html');
  const packed = await packedBoardData();
  const html = await liveBoardHtml(packed);
  const existing = await pathExists(indexPath);
  const staleShell = existing && externalBoardScriptPattern().test(await fs.readFile(indexPath, 'utf8'));
  if (force || !existing || staleShell) {
    try { await snapshotHistory(); } catch { /* first shell */ }
  }
  await fs.writeFile(indexPath, html);
  await relocateRootBoardShells();
  await removeBoardSidecars();
  await ensureIgnore();
  if (verbose) {
    console.log(`wrote ${indexPath}`);
  }
}

function mermaidDiagram(title, source) {
  const body = String(source || '').trim().replace(/</g, '&lt;');
  return `<div class="diagram mermaid-live">
      <p class="diagram-title">${inline(title)}</p>
      <pre class="mermaid">${body}</pre>
    </div>`;
}

function renderTable(lines) {
  const rows = lines
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => inline(cell.trim())));
  if (rows.length < 2) return '';
  const head = rows[0].map((cell) => `<th>${cell}</th>`).join('');
  const body = rows.slice(2).map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function parseMarkdownTable(lines) {
  const rows = lines
    .filter((line) => /^\|.*\|$/.test(line.trim()))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()));
  if (rows.length < 2) return null;
  return { headers: rows[0], rows: rows.slice(2) };
}

function extractTables(md) {
  const lines = md.split(/\r?\n/);
  const tables = [];
  const withoutTables = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\|.*\|$/.test(lines[i].trim()) && i + 1 < lines.length && /^\|\s*-/.test(lines[i + 1].trim())) {
      const tableLines = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const parsed = parseMarkdownTable(tableLines);
      if (parsed) tables.push(parsed);
      continue;
    }
    withoutTables.push(lines[i]);
    i += 1;
  }
  return { tables, markdown: withoutTables.join('\n').trim() };
}

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|\s*-/.test(lines[i + 1].trim())) {
      const table = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        table.push(lines[i]);
        i += 1;
      }
      out.push(renderTable(table));
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\|.*\|$/.test(lines[i].trim()) &&
      !/^- /.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}

async function markdownToHtmlWithRenderedMermaid(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      if (lang.toLowerCase() === 'mermaid') {
        out.push(await mermaidDiagram('Markdown 图示', code.join('\n')));
      } else {
        out.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      }
      continue;
    }
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|\s*-/.test(lines[i + 1].trim())) {
      const table = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        table.push(lines[i]);
        i += 1;
      }
      out.push(renderTable(table));
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^-\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const paragraph = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\|.*\|$/.test(lines[i].trim()) &&
      !/^- /.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return out.join('\n');
}

function extractSection(md, headingText) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^##\\s+\\d*\\.?\\s*${headingText}`).test(line));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function sectionTitle(section) {
  const match = section.match(/^##\s+(.+)$/m);
  return match ? match[1].replace(/^\d+\.\s*/, '').trim() : '评审内容';
}

function sectionTypeForTitle(title) {
  if (/问题表格|问题澄清/.test(title)) return 'problem-table';
  if (/旅程.*故事.*验收|追踪矩阵/.test(title)) return 'traceability-matrix';
  if (/时序图|状态机|状态流转/.test(title)) return 'state-or-sequence';
  if (/ER\s*图|实体关系/.test(title)) return 'er-diagram';
  if (/API|接口/.test(title)) return 'api-catalog';
  if (/测试矩阵|覆盖矩阵|测试用例/.test(title)) return 'test-matrix';
  if (/任务计划|开发计划|并行边界|验证命令/.test(title)) return 'delivery-plan';
  if (/风险|待确认|评审/.test(title)) return 'risk-review';
  return 'general-review';
}

function componentDescriptionForType(type) {
  const descriptions = {
    'problem-table': '用于确认事实、假设、风险和待确认问题是否分离清楚。',
    'traceability-matrix': '用于确认用户旅程、用户故事、验收标准和下游验证之间是否能追踪。',
    'state-or-sequence': '用于确认跨角色交互、状态变化和异常路径是否清楚。',
    'er-diagram': '用于确认实体、关系、关键字段和数据边界是否清楚。',
    'api-catalog': '用于确认接口用途、字段、鉴权、错误码和调用方是否清楚。',
    'test-matrix': '用于确认验收标准、测试用例、优先级和风险覆盖是否完整。',
    'delivery-plan': '用于确认任务顺序、依赖、并行边界、验证命令和发布门禁。',
    'risk-review': '用于确认风险、影响、负责人和下一步动作。',
    'general-review': '用于把当前章节转换为可扫读、可讨论、可决策的评审组件。',
  };
  return descriptions[type] || descriptions['general-review'];
}

function bulletsFromMarkdown(md) {
  return md
    .split(/\r?\n/)
    .filter((line) => /^-\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim()))
    .map((line) => line.trim().replace(/^-\s+/, '').replace(/^\d+\.\s+/, ''));
}

function paragraphsFromMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n{2,}/)
    .map((block) => block.replace(/^#{1,5}\s+.+$/gm, '').trim())
    .filter(Boolean)
    .filter((block) => !/^[-\d]/.test(block.trim()))
    .slice(0, 3);
}

function codeBlocksFromMarkdown(md) {
  return [...md.matchAll(/```(\w+)?\n([\s\S]*?)```/g)].map((match) => ({
    lang: match[1] || '',
    body: match[2].trim(),
  }));
}

function stateFlowFromCodeBlock(title, code) {
  if (!/CREATED|PAID|INVENTORY_LOCKED|DISPUTE_OPENED/.test(code)) return '';
  return stateMachine(title, [
    { name: 'CREATED', note: '记录创建' },
    { name: 'PAID', note: '已支付' },
    { name: 'INVENTORY_LOCKED', note: '库存锁定' },
    { name: 'SELLER_PROCESSING', note: '处理中' },
    { name: 'SELLER_DELIVERED', note: '已交付' },
    { name: 'PLATFORM_VERIFIED', note: '平台验证' },
    { name: 'COMPLETED', note: '流程完成' },
    { name: 'TIMEOUT', note: '履约超时' },
    { name: 'DISPUTE_OPENED', note: '争议开启' },
    { name: 'SUPPORT_RESOLVED', note: '支持处理' },
    { name: 'REFUNDED', note: '退款关闭' },
  ], [
    { from: 'CREATED', to: 'PAID', label: '支付' },
    { from: 'PAID', to: 'INVENTORY_LOCKED', label: '锁库存' },
    { from: 'INVENTORY_LOCKED', to: 'SELLER_PROCESSING', label: '业务处理' },
    { from: 'SELLER_PROCESSING', to: 'SELLER_DELIVERED', label: '交付' },
    { from: 'SELLER_DELIVERED', to: 'PLATFORM_VERIFIED', label: '验证' },
    { from: 'PLATFORM_VERIFIED', to: 'COMPLETED', label: '完成' },
    { from: 'PAID', to: 'TIMEOUT', label: '超时' },
    { from: 'TIMEOUT', to: 'DISPUTE_OPENED', label: '申诉' },
    { from: 'DISPUTE_OPENED', to: 'SUPPORT_RESOLVED', label: '支持处理' },
    { from: 'SUPPORT_RESOLVED', to: 'COMPLETED', label: '继续完成' },
    { from: 'SUPPORT_RESOLVED', to: 'REFUNDED', label: '退款' },
  ]);
}

function groupKeyForTable(title, headers) {
  const preferred = [
    /优先级/,
    /用户旅程/,
    /旅程/,
    /用户画像|角色/,
    /里程碑/,
    /领域|模块/,
    /状态|风险/,
    /覆盖/,
  ];
  for (const rule of preferred) {
    const index = headers.findIndex((header) => rule.test(header));
    if (index >= 0) return index;
  }
  if (/测试/.test(title)) {
    const priority = headers.findIndex((header) => /优先级/.test(header));
    if (priority >= 0) return priority;
  }
  return 0;
}

function groupedRows(table, groupIndex) {
  const groups = new Map();
  for (const row of table.rows) {
    const key = row[groupIndex] || '未分组';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()];
}

function rowCard(row, headers, groupIndex) {
  const titleIndex = headers.findIndex((header, index) => index !== groupIndex && /编号|用户故事|场景|任务|接口|模块|验收|里程碑|领域/.test(header));
  const actualTitleIndex = titleIndex >= 0 ? titleIndex : headers.findIndex((_, index) => index !== groupIndex);
  const title = row[actualTitleIndex] || row[0] || '评审项';
  const details = headers
    .map((header, index) => ({ header, value: row[index] || '' }))
    .filter((item, index) => index !== groupIndex && index !== actualTitleIndex && item.value)
    .map((item) => `<div><span>${inline(item.header)}</span><p>${inline(item.value)}</p></div>`)
    .join('');
  return `<article class="review-card"><strong>${inline(title)}</strong><div class="review-card-grid">${details}</div></article>`;
}

function shouldUseTabs(groups) {
  if (groups.length <= 1) return false;
  const total = groups.reduce((sum, [, rows]) => sum + rows.length, 0);
  const average = total / groups.length;
  const singleGroupCount = groups.filter(([, rows]) => rows.length === 1).length;
  const mostlySingle = singleGroupCount / groups.length > 0.5;
  return groups.length <= 6 && average > 1 && !mostlySingle;
}

function flatTableComponent(title, table, groupIndex, groups, sectionType = 'general-review') {
  const allRows = groups.flatMap(([group, rows]) => rows.map((row) => ({ group, row })));
  const fields = table.headers
    .map((header, index) => ({ header, index }))
    .filter((item) => item.index !== groupIndex);
  return `<div class="review-component table-component flat-component">
    <div class="component-heading">
      <h4>${inline(title)}：纵向表格评审</h4>
      <p>${inline(componentDescriptionForType(sectionType))} 完整 Markdown 保留在 AI 视图。</p>
    </div>
    <div class="pane-summary"><strong>${inline(table.headers[groupIndex] || '评审项')}</strong><span>${allRows.length} 项</span></div>
    <div class="flat-table" role="table" aria-label="${escapeHtml(title)} 纵向评审表" style="--flat-cols:${fields.length}">
      <div class="flat-table-head" role="row">
        <span>${inline(table.headers[groupIndex] || '分组')}</span>
        ${fields.map((field) => `<span>${inline(field.header)}</span>`).join('')}
      </div>
      ${allRows.map(({ group, row }) => `<div class="flat-table-row" role="row">
        <div class="flat-table-key" role="cell"><span>${inline(table.headers[groupIndex] || '分组')}</span><strong>${inline(group)}</strong></div>
        ${fields.map((field) => `<div class="flat-table-cell" role="cell"><span>${inline(field.header)}</span><p>${inline(row[field.index] || '')}</p></div>`).join('')}
      </div>`).join('')}
    </div>
  </div>`;
}

function visualTableComponent(title, table, tableIndex, sectionType = 'general-review') {
  const groupIndex = groupKeyForTable(title, table.headers);
  const groups = groupedRows(table, groupIndex);
  if (!shouldUseTabs(groups)) {
    return flatTableComponent(title, table, groupIndex, groups, sectionType);
  }
  const componentId = `component-${tableIndex}-${componentCounter++}`;
  return `<div class="review-component table-component" data-component="${componentId}">
    <div class="component-heading">
      <h4>${inline(title)}：${inline(table.headers[groupIndex] || '分组')}视图</h4>
      <p>${inline(componentDescriptionForType(sectionType))} 完整 Markdown 保留在 AI 视图。</p>
    </div>
    <div class="component-tabs" role="tablist" aria-label="${escapeHtml(title)} 分组">
      ${groups.map(([group], index) => `<button class="component-tab" data-component-tab="${componentId}" data-component-target="${index}" aria-selected="${index === 0}">${inline(group)}</button>`).join('')}
    </div>
    ${groups.map(([group, rows], index) => `<div class="component-pane" data-component-pane="${componentId}" data-component-index="${index}" ${index === 0 ? '' : 'hidden'}>
      <div class="pane-summary"><strong>${inline(group)}</strong><span>${rows.length} 项</span></div>
      <div class="review-card-list">${rows.map((row) => rowCard(row, table.headers, groupIndex)).join('')}</div>
    </div>`).join('')}
  </div>`;
}

async function sectionComponent(section, index) {
  const title = sectionTitle(section);
  const sectionType = sectionTypeForTitle(title);
  const { tables, markdown } = extractTables(section);
  const codeBlocks = codeBlocksFromMarkdown(markdown);
  const mermaidComponents = (await Promise.all(codeBlocks
    .filter((block) => block.lang.toLowerCase() === 'mermaid')
    .map((block) => mermaidDiagram(title, block.body))))
    .join('');
  const codeComponents = codeBlocks
    .filter((block) => block.lang.toLowerCase() !== 'mermaid')
    .map((block) => stateFlowFromCodeBlock(title, block.body))
    .filter(Boolean)
    .join('');
  const bullets = bulletsFromMarkdown(markdown);
  const paragraphs = paragraphsFromMarkdown(markdown);
  const intro = paragraphs.length
    ? `<div class="component-intro">${paragraphs.map((paragraph) => `<p>${inline(paragraph.replace(/\n/g, ' '))}</p>`).join('')}</div>`
    : '';
  const cards = bullets.length
    ? `<div class="compact-card-grid">${bullets.map((item) => `<div class="compact-card"><span>评审点</span><p>${inline(item)}</p></div>`).join('')}</div>`
    : '';
  const tableComponents = tables
    .map((table, tableIndex) => visualTableComponent(title, table, index * 10 + tableIndex, sectionType))
    .join('');
  const fallbackMarkdown = markdown.replace(/```mermaid\n[\s\S]*?```/g, '').trim();
  const fallback = !intro && !cards && !tableComponents && !codeComponents && !mermaidComponents
    ? markdownToHtml(fallbackMarkdown)
    : '';
  return `<section class="review-component">
    <div class="component-heading">
      <h3>${inline(title)}</h3>
      <p>${inline(componentDescriptionForType(sectionType))}</p>
    </div>
    ${intro}
    ${mermaidComponents}
    ${codeComponents}
    ${cards}
    ${tableComponents}
    ${fallback}
  </section>`;
}

async function componentizedSections(md, names) {
  return (await Promise.all(names
    .map((name) => extractSection(md, name))
    .filter(Boolean)
    .map((section, index) => sectionComponent(section, index))))
    .join('\n');
}

function visualCards(title, cards) {
  return `<div class="visual-section"><h3>${inline(title)}</h3><div class="card-grid">${cards.map((card) => `<div class="info-card"><strong>${inline(card.title)}</strong><p>${inline(card.body)}</p></div>`).join('')}</div></div>`;
}

function reviewGate(items) {
  return `<div class="review-box"><strong>本 tab 评审重点</strong><ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></div>`;
}

const KEY_REVIEW_DETAILS = {
  clarify: {
    action: '先确认原始需求、事实、假设、待确认问题是否分离；任何假设如果会改变 PRD 范围，都必须先回到澄清阶段补证据。',
    targetLabel: '跳到问题澄清表格',
  },
  'project-wiki': {
    action: '重点检查相关 repo、owner、系统边界和验证命令是否可信；发现 repo wiki 与当前需求冲突时，不继续推进 PRD 或技术方案。',
    targetLabel: '跳到仓库与边界证据',
  },
  prd: {
    action: '确认用户故事、验收标准、范围内/范围外能否支撑测试和实现；验收标准不可测试时，先修 PRD。',
    targetLabel: '跳到 PRD 评审锚点',
  },
  prototype: {
    action: '确认主流程、风险状态、权限状态和降级状态都有页面或状态覆盖；缺失状态不能只靠口头说明。',
    targetLabel: '跳到原型覆盖清单',
  },
  'test-cases': {
    action: '逐项核对 AC 是否有测试用例覆盖，尤其是 P0、敏感数据、权限、降级和回归风险。',
    targetLabel: '跳到测试覆盖锚点',
  },
  'test-automation': {
    action: '确认自动化范围、分层、命令和证据能被开发计划消费；标记不适用的必须写明原因，配置要求 required 时必须有显式覆盖记录。',
    targetLabel: '跳到自动化计划锚点',
  },
  'technical-solution': {
    action: '检查架构边界、接口字段、权限、观测、降级和回滚是否能解释所有 P0 风险；讲不清的地方不能进入开发计划。',
    targetLabel: '跳到技术评审锚点',
  },
  'development-plan': {
    action: '确认任务已经小到可独立实现和评审，并且每个任务都有测试先行点、验证命令、依赖边界和回滚要求。',
    targetLabel: '跳到开发评审锚点',
  },
  'start-implement': {
    action: '开工前必须确认 Project Wiki、PRD、原型、测试、技术方案和开发计划都已批准或明确不适用；否则保持 Draft，不进入业务实现。',
    targetLabel: '跳到开工门禁',
  },
  develop: {
    action: '开发执行页必须说明真实业务实现是否已经发生，并回写修改文件、测试结果、验证证据、安全检查和回滚说明。',
    targetLabel: '跳到开发执行记录',
  },
};

function keyReviewItem(id, items) {
  const item = items.find(Boolean) || '确认本阶段是否满足继续推进的门禁；不满足时先停止推进并补齐证据。';
  const detail = KEY_REVIEW_DETAILS[id] || {
    action: '确认本阶段是否满足继续推进的门禁；不满足时先停止推进并补齐证据。',
    targetLabel: '跳到关键内容',
  };
  const targetId = `${id}-key-content`;
  return `<div class="key-review-box">
    <strong>关键评审项</strong>
    <p class="key-review-question">${inline(item)}</p>
    <p class="key-review-action">${inline(detail.action)}</p>
    <a class="key-review-link" href="#${targetId}" data-stage-link="${id}" data-target-id="${targetId}">${inline(detail.targetLabel)}</a>
  </div>`;
}

function summaryList(title, items) {
  return `<div class="summary-box"><strong>${inline(title)}</strong><ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul></div>`;
}

function contextBox(items) {
  return `<div class="context-box">
    <strong>阅读上下文</strong>
    <div class="context-grid">
      ${items.map((item) => `<div><span>${inline(item.label)}</span><p>${inline(item.value)}</p></div>`).join('')}
    </div>
  </div>`;
}

function aiMarkdown(md, fallback = '当前阶段没有独立 Markdown 源内容。') {
  const source = md && md.trim() ? md.trim() : fallback;
  return `<pre class="ai-source"><code>${escapeHtml(source)}</code></pre>`;
}

async function markdownPreview(md, fallback = '当前阶段没有独立 Markdown 源内容。') {
  const source = md && md.trim() ? md.trim() : fallback;
  return `<section class="markdown-preview" aria-label="Markdown 渲染预览">
    <div class="component-heading">
      <h3>Markdown 渲染预览</h3>
      <p>这里把本阶段 Markdown 源内容完整渲染出来，便于用户直接预览正文、表格、列表和代码块。</p>
    </div>
    <div class="markdown-preview-body">${await markdownToHtmlWithRenderedMermaid(source)}</div>
  </section>`;
}

function statusClass(status) {
  if (status === '已评审') return 'reviewed';
  if (status === '未生成' || status === '不适用') return 'empty';
  if (status === '阻断') return 'blocked';
  return 'draft';
}

// 「已回改待复审」从 .workflow-state.json 派生：stage 值为对象且 revising === true 时显示。
// 状态回 Draft 由写入方（阶段 skill）负责，本脚本只读不写。
const isRevising = (id) => {
  const value = stateStages[id];
  return Boolean(value && typeof value === 'object' && value.revising);
};
const revisingBadge = (id) => (isRevising(id) ? '<span class="status draft">已回改待复审</span>' : '');

// 「已豁免 · 未完成」从 .workflow-state.json 的 waivers[] 派生：
// { task, owner, reason, waived_at, stage? }。未写 stage 的豁免挂在开工和开发执行两个 tab。
const WAIVER_DEFAULT_STAGES = ['start-implement', 'develop'];
const waiversFor = (id) => (Array.isArray(workflowState.waivers) ? workflowState.waivers : [])
  .filter((w) => w && (w.stage ? w.stage === id : WAIVER_DEFAULT_STAGES.includes(id)));
const waiverBadges = (id) => waiversFor(id)
  .map((w) => `<span class="status waived" title="${escapeHtml(w.reason || '')}">已豁免 · 未完成 · ${escapeHtml(w.task || '')} · 责任人 ${escapeHtml(w.owner || '未记录')}${w.waived_at ? ` · ${escapeHtml(w.waived_at)}` : ''}</span>`)
  .join('');

async function tab(id, status, title, contextItems, gateItems, diagrams, humanHtml, aiMd) {
  const panelClass = id === defaultStage ? 'panel active' : 'panel';
  return `<section id="${id}" class="${panelClass}">
    <span class="status ${statusClass(status)}">${status}</span>${revisingBadge(id)}${waiverBadges(id)}
    <h2>${title}</h2>
    <div class="view-switch" role="tablist" aria-label="${title} 视图切换">
      <button class="view-button" data-view="human" aria-selected="true">给人看的评审视图</button>
      <button class="view-button" data-view="ai" aria-selected="false">给 AI 看的 Markdown 源码</button>
    </div>
    <div class="view-pane human-view" data-view-pane="human">
      ${keyReviewItem(id, gateItems)}
      ${contextBox(contextItems)}
      ${reviewGate(gateItems)}
      ${diagrams.join('\n')}
      <div class="artifact-body" id="${id}-key-content" tabindex="-1">${humanHtml}</div>
      ${await markdownPreview(aiMd)}
    </div>
    <div class="view-pane ai-view" data-view-pane="ai" hidden>
      <div class="review-box"><strong>Markdown 源码 / AI 续写内容</strong><p>这一视图保留完整源内容，便于复制、追踪、修改和后续 AI/agent 继续生成。</p></div>
      ${aiMarkdown(aiMd)}
    </div>
  </section>`;
}

if (restoreTarget) {
  try {
    const restored = await restoreHistory(restoreTarget);
    console.log(`已回滚到 ${restored.id}：${restored.files.join(', ')}`);
    process.exit(0);
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}
if (!argv.includes('--bake')) {
  await writeLiveBoard();
  process.exit(0);
}
const stateStages = workflowState.stages || workflowState.phases || {};
const normalizeStatus = (value) => {
  const raw = typeof value === 'object' && value ? value.status : value;
  const normalized = String(raw || '').trim().toLowerCase();
  const map = {
    reviewed: '已评审',
    approved: '已评审',
    done: '已评审',
    draft: '草稿',
    blocked: '阻断',
    empty: '未生成',
    missing: '未生成',
    'not generated': '未生成',
    'not-generated': '未生成',
    'not_applicable': '不适用',
    'not-applicable': '不适用',
    'not applicable': '不适用',
    na: '不适用',
    'n/a': '不适用',
    '已评审': '已评审',
    '草稿': '草稿',
    '阻断': '阻断',
    '未生成': '未生成',
    '不适用': '不适用',
  };
  return map[normalized] || '';
};
const stageStatus = (id, hasContent, defaultWhenContent = '草稿') =>
  normalizeStatus(stateStages[id]) || (hasContent ? defaultWhenContent : '未生成');
const productTitle = workflowState.title || prd.match(/^#\s+PRD:\s*(.+)$/m)?.[1]?.trim() || '产品工作流需求';
const defaultStage = workflowState.currentStage || workflowState.current_stage || 'clarify';
const STAGE_LABELS_ZH = {
  clarify: '问题澄清',
  'project-wiki': 'Project Wiki',
  prd: 'PRD',
  prototype: '原型',
  'test-cases': '测试用例',
  'test-automation': '自动化测试计划',
  'technical-solution': '技术方案',
  'development-plan': '开发计划',
  'start-implement': '开工',
  develop: '开发执行',
};
const stageLabelOf = (id) => STAGE_LABELS_ZH[id] || id;
const clarifySection = clarify || extractSection(prd, '问题表格') || extractSection(prd, '问题卡片') || prd;

const clarifyHtml = markdownToHtml(clarifySection);
const projectWikiHtml = markdownToHtml(projectWiki);
const prdHtml = markdownToHtml(prd);
const testHtml = markdownToHtml(tests);
const automationPlanHtml = markdownToHtml(automationPlan);
const techHtml = markdownToHtml(tech);
const planHtml = markdownToHtml(plan);
const clarifyMd = clarifySection;
const repoWikiLinksHtml = repoWikiFiles.length
  ? visualCards('生成的 repo wiki', repoWikiFiles.map((file) => ({
    title: file.replace(/^repo-wikis\//, ''),
    body: `已生成并纳入 Project Wiki 路由：${file}`,
  }))) + `<ul>${repoWikiFiles.map((file) => `<li><a href="./${escapeHtml(file)}">${escapeHtml(file)}</a></li>`).join('')}</ul>`
  : '';
const repoWikiLinksMd = repoWikiFiles.length
  ? `\n\n## 生成的 repo wiki\n\n${repoWikiFiles.map((file) => `- [${file}](${file})`).join('\n')}`
  : '';

const startImplementMd = startImplement || `# 开工

状态：${stageStatus('start-implement', false)}

开工命令：

\`\`\`text
$product:kickoff
\`\`\`

进入实现前必须完成开工检查，并等待用户批准执行模式。`;
const developMd = develop || `# 开发执行

状态：未生成

开发命令：

\`\`\`text
$product:develop ${root}
\`\`\`

进入开发前必须批准 Project Wiki、PRD、原型、测试用例、技术方案和开发计划。`;

const artifactLine = (label, href, exists) =>
  exists ? `<p>${label}：<a href="./${href}">${href}</a></p>` : `<p>${label}：未生成</p>`;

const notApplicableArtifactLine = (label, href) =>
  `<p>${label}：${href}（Not Applicable / 不适用）</p>`;

function inferStitchStatus(md, hasExplicitStageStatus, explicitStageStatus, fallbackStatus) {
  if (hasExplicitStageStatus) return explicitStageStatus || fallbackStatus;
  const explicit = md.match(/^状态：\s*(.+)$/m)?.[1]?.trim();
  return normalizeStatus(explicit) || fallbackStatus;
}

async function stitchPrototypeHumanHtml(md, htmlPrototypeExists, status) {
  if (!md) return '';
  const statusSummary = status === '阻断'
    ? summaryList('Stitch 阻断恢复动作', [
      '修复或配置 Stitch MCP/SDK 后重试本阶段。',
      '或由用户明确批准切换 HTML 路线继续。',
      '不能自动改走 HTML 原型。',
    ])
    : summaryList('Stitch 原型评审锚点', [
      '确认 Stitch 项目链接、screen/frame 清单和状态覆盖真实可评审。',
      '确认业务范围、用户任务和体验意图已映射到 Stitch 证据或缺口。',
      '确认评审缺口不会被写成已批准事实。',
    ]);
  const combinationSummary = htmlPrototypeExists
    ? summaryList('组合原型路线', [
      '当前目录同时存在 Stitch 记录和 HTML 原型。',
      'Stitch 负责外部设计画布证据，prototype.html 负责本地交互预览。',
      '评审时需要确认两个产物表达的主流程和状态没有冲突。',
    ])
    : '';
  return `${statusSummary}${combinationSummary}${await componentizedSections(md, [
    'Stitch 项目信息',
    'MCP/SDK 能力检查',
    '业务范围覆盖矩阵',
    '状态覆盖',
    '评审缺口',
    '恢复路径',
  ])}${artifactLine('Stitch 原型记录', 'stitch-prototype.md', true)}${htmlPrototypeExists ? artifactLine('HTML 原型文件', 'prototype.html', true) : notApplicableArtifactLine('HTML 原型文件', 'prototype.html')}`;
}

const hasExplicitPrototypeStatus = Object.prototype.hasOwnProperty.call(stateStages, 'prototype');
const explicitPrototypeStatus = hasExplicitPrototypeStatus ? normalizeStatus(stateStages.prototype) : '';
const prototypeStatus = explicitPrototypeStatus || stageStatus('prototype', prototypeExists || stitchPrototypeExists);
const stitchStatus = stitchPrototypeExists
  ? inferStitchStatus(stitchPrototype, hasExplicitPrototypeStatus, explicitPrototypeStatus, prototypeStatus)
  : prototypeStatus;
const prototypeMd = stitchPrototypeExists ? stitchPrototype : `# 原型

状态：草稿
文件：prototype.html

## 评审目的

- 验证 PRD 定义的用户、后台处理方、支持方和运营视角是否覆盖。
- 验证主流程、风险状态、权限状态和降级状态是否能被评审。
- 原型 HTML 源文件保留在同目录 \`prototype.html\`，评审看板内嵌当前原型，修改源头后重新生成。`;
const prototypePreview = prototypeExists
  ? `<iframe title="交互原型" sandbox="allow-scripts allow-forms" style="width:100%;min-height:720px;border:0" srcdoc="${escapeHtml(prototype)}"></iframe>`
  : '<p>尚未生成 HTML 原型。</p>';
const prototypeHumanHtml = prototypePreview + (stitchPrototypeExists
  ? await stitchPrototypeHumanHtml(stitchPrototype, prototypeExists, stitchStatus)
  : artifactLine('原型源文件', 'prototype.html', prototypeExists));

const tabs = [
  await tab('clarify', stageStatus('clarify', Boolean(clarifyMd)), '问题澄清', [
    { label: '为什么看', value: '先把一句需求拆成事实、假设和待确认问题，避免后续 PRD 建在错误前提上。' },
    { label: '谁来评审', value: '产品负责人、业务方、对目标业务流程熟悉的人。' },
    { label: '要做的决策', value: '确认需求焦点、事实、假设和必须继续验证的问题。' },
    { label: '前置上下文', value: `当前产物是 ${productTitle} 的演示稿，不代表业务方已批准上线。` },
  ], [
    '事实、假设、待确认问题是否分离清楚。',
    '目标用户、触发场景、成功指标是否足够支撑 PRD。',
    '如果假设错误，必须先回到本阶段修正。',
  ], [
    await mermaidDiagram('原始需求如何澄清成问题表格', `flowchart LR
  A["原始需求"] --> B["确认事实"]
  B --> C["标记假设"]
  C --> D["列出待确认问题"]
  D --> E["问题表格"]`),
  ], summaryList('评审锚点', [
    '确认问题表格是否已经覆盖原始需求、事实、假设、待确认问题。',
    '确认当前阶段只到澄清，不把假设写成已批准需求。',
    '确认后续 PRD 应围绕当前需求目标，不把本期扩散成整套系统重构。',
  ]) + await componentizedSections(clarifySection, ['问题表格', '问题卡片', '原始需求', '业务背景', '项目上下文', '目标用户', '用户任务', '痛点', '触发场景', '成功指标', '风险', '待确认问题', '评审清单']), clarifyMd),
  await tab('project-wiki', stageStatus('project-wiki', Boolean(projectWiki)), 'Project Wiki', [
    { label: '为什么看', value: '把多个 repo、多包 workspace 或跨部署单元的项目事实统一成后续 PRD、技术方案和开发计划可引用的上下文。' },
    { label: '谁来评审', value: '产品负责人、研发负责人、仓库 owner、架构师、QA 和运维负责人。' },
    { label: '要做的决策', value: '确认仓库职责、repo wiki 状态、系统边界、共享契约和验证命令是否可信。' },
    { label: '前置上下文', value: `问题澄清已经定义 ${productTitle} 的业务目标，Project Wiki 负责把项目事实和仓库边界对齐。` },
  ], [
    '有 repo wiki 的仓库是否只做引用、摘要和冲突检查。',
    '没有 repo wiki 的仓库是否已经生成 repo wiki，并明确证据、推断和待 owner 确认项。',
    '仓库 ownership、共享契约、验证命令和待确认问题是否足够支撑 PRD 和技术方案。',
  ], [
    await mermaidDiagram('Project Wiki 如何收敛跨仓上下文', `flowchart LR
  A["问题澄清"] --> B["识别 repo / package"]
  B --> C{"已有 repo wiki?"}
  C -->|有| D["引用 / 摘要 / 冲突检查"]
  C -->|无| E["生成 repo-wikis/<repo>.md"]
  D --> F["Project Wiki"]
  E --> F
  F --> G["PRD / 技术方案 / 开发计划"]`),
  ], summaryList('Project Wiki 评审锚点', [
    '每个相关 repo 都有 wiki 状态、职责、边界和证据来源。',
    '已有 repo wiki 不被整篇复制，只抽取需求相关事实并检查过期或冲突。',
    '缺少 repo wiki 的仓库已经生成 repo wiki，推断内容不会写成团队已确认约定。',
    '跨仓 API、状态、权限、事件、发布和回滚边界能被后续阶段引用。',
  ]) + (projectWiki
    ? await componentizedSections(projectWiki, ['仓库', 'Repo Wiki', '系统边界', '跨仓流程', '共享契约', '本地开发', '验证', '术语', '风险', '待确认'])
    : `<p>当前没有 <code>project-wiki.md</code>。请使用已有授权材料核对跨仓边界；需要创建或更新知识时可选择 <code>$wiki</code>。</p>`) + repoWikiLinksHtml, (projectWiki || `# Project Wiki

状态：未生成

跨仓边界按授权材料核对。需要创建或更新知识时可选择：

\`\`\`text
$wiki
\`\`\``) + repoWikiLinksMd),
  await tab('prd', stageStatus('prd', Boolean(prd)), 'PRD', [
    { label: '为什么看', value: '把问题澄清转成可设计、可测试、可实现的产品范围和验收标准。' },
    { label: '谁来评审', value: '产品负责人、设计、QA、研发负责人、业务代表。' },
    { label: '要做的决策', value: '确认用户旅程、用户故事、验收标准是否一一对应，范围是否可接受。' },
    { label: '前置上下文', value: `问题澄清和 Project Wiki 已经把 ${productTitle} 的目标用户、业务假设、项目事实和风险边界显式列出。` },
  ], [
    '用户故事是否覆盖当前需求涉及的主要角色、后台处理方和运营评估方。',
    '验收标准是否可测试、可追踪。',
    '范围和非目标是否能阻止需求蔓延。',
  ], [
    await mermaidDiagram('用户从需求判断到结果确认', `journey
  title 用户从需求判断到结果确认
  section 决策
    查看详情: 3: 用户
    理解规则: 4: 用户
    操作确认: 4: 用户
  section 执行
    支付或确认: 3: 用户
    状态时间线: 4: 用户
    异常处理: 2: 用户,支持`),
    await componentizedSections(prd, ['时序图与状态机']),
  ], summaryList('评审锚点', [
    '用户故事覆盖主要业务参与方、后台处理方和运营评估方。',
    '验收标准可追踪到测试、技术方案和开发计划。',
    '范围内聚焦本期核心链路、关键状态、后台处理和指标评估。',
    '范围外明确排除需要单独立项的大型底层系统改造。',
  ]) + await componentizedSections(prd, ['目标用户', '范围', '用户故事', '核心旅程', '旅程-故事-验收标准追踪矩阵', '验收标准', '指标', '风险']), prd),
  await tab('prototype', stitchStatus, '原型', [
    { label: '为什么看', value: '用页面和状态验证 PRD 是否能被用户理解，而不是只停留在文字描述。' },
    { label: '谁来评审', value: '产品、设计、前端、业务方、支持代表。' },
    { label: '要做的决策', value: '确认关键页面、信息层级、异常状态和权限展示是否合理。' },
    { label: '前置上下文', value: '原型围绕 PRD 定义的角色、流程、状态和 Project Wiki 中的产品边界组织。' },
  ], [
    '原型是否覆盖主流程、风险状态、权限状态和降级状态。',
    '评审者不打开单独原型，也能判断页面清单和状态覆盖。',
  ], [
    await mermaidDiagram('原型页面之间的主要跳转', `flowchart LR
  A["对象详情"] --> B["操作确认"]
  B --> C["结果详情"]
  C --> D["后台工作台"]
  C --> E["支持证据"]
  E --> F["指标看板"]`),
  ], prototypeHumanHtml, prototypeMd),
  await tab('test-cases', stageStatus('test-cases', Boolean(tests)), '测试用例', [
    { label: '为什么看', value: '把 PRD 的 AC 转成可执行验证，提前发现核心流程、权限、降级和回归风险。' },
    { label: '谁来评审', value: 'QA、产品、研发、风控/支持代表。' },
    { label: '要做的决策', value: '确认每条 AC 是否有用例覆盖，P0 是否覆盖上线前必须通过的风险。' },
    { label: '前置上下文', value: 'P0 影响核心流程、敏感数据、权限或关键状态透明度；P1/P2 影响体验、运营和回归。' },
  ], [
    '每条 AC 是否至少有一条用例覆盖。',
    'P0 是否覆盖核心流程、敏感数据、权限和降级。',
    '准备、操作、期望结果、自动化建议是否完整。',
  ], [
    await mermaidDiagram('验收标准到测试用例的追踪关系', `flowchart LR
  A["核心展示与操作 AC"] --> B["用户主链路测试"]
  C["状态与异常 AC"] --> D["后台与支持测试"]
  E["运营与灰度 AC"] --> F["指标 / 灰度 / 降级测试"]`),
  ], summaryList('测试覆盖锚点', [
    '测试用例覆盖 PRD 中的主要验收标准。',
    'P0 覆盖核心流程成功、敏感数据安全、权限安全、核心状态透明度。',
    '包含降级、权限、灰度、导出脱敏、埋点和回归风险。',
    '退出标准要求 P0 全部通过，P1 至少 95% 通过。',
  ]) + await componentizedSections(tests, ['覆盖策略', '测试矩阵', '回归范围', '必需测试数据', '退出标准']), tests),
  await tab('test-automation', stageStatus('test-automation', Boolean(automationPlan)), '自动化测试计划', [
    { label: '为什么看', value: '把测试用例里适合自动化的部分落成分层计划和 AUTO-TASK，技术方案和开发计划据此排期；不适用时也要留下原因。' },
    { label: '谁来评审', value: 'QA、研发负责人、CI/发布负责人。' },
    { label: '要做的决策', value: '确认自动化分层、目标 repo、测试入口、命令和证据是否可执行；确认不适用或豁免是否成立。' },
    { label: '前置上下文', value: '本阶段在测试用例之后、技术方案之前；初始化配置 test_automation 为 required 时，不适用必须有 explicit_override。' },
  ], [
    '每个 AUTO-TASK 是否有目标 repo、测试入口、命令和证据要求。',
    '不适用或阻断是否写明原因、风险和后续回收点。',
    '分层（单元 / API / contract / E2E）是否覆盖 P0 回归风险。',
  ], [
    await mermaidDiagram('自动化测试计划如何进入开发计划', `flowchart LR
  A["测试用例"] --> B["自动化范围与分层"]
  B --> C["AUTO-TASK 清单"]
  C --> D["技术方案"]
  D --> E["开发计划消费 AUTO-TASK"]`),
  ], summaryList('自动化计划锚点', [
    '自动化范围、分层与不做自动化的部分都有明确说明。',
    'AUTO-TASK 可被开发计划直接消费。',
    '状态为不适用或阻断时，原因、风险和回收点已写入本文件与 state。',
  ]) + (automationPlan
    ? await componentizedSections(automationPlan, ['范围', '分层', 'AUTO-TASK', '命令', '证据', '不适用', '风险'])
    : '<p>当前还没有生成 <code>automation-test-plan.md</code>。涉及实现、API/UI 行为或回归风险的需求，进入技术方案前应先执行 <code>$product:test-automation</code>；纯文档需求可标记不适用并写明原因。</p>'), automationPlan || `# 自动化测试计划

状态：未生成

进入技术方案前请执行：

\`\`\`text
$product:test-automation
\`\`\``),
  await tab('technical-solution', stageStatus('technical-solution', Boolean(tech)), '技术方案', [
    { label: '为什么看', value: '把 PRD 和测试风险落到架构、接口、状态、权限、降级和回滚方案。' },
    { label: '谁来评审', value: '架构师、后端、前端、QA、安全/风控、运维。' },
    { label: '要做的决策', value: '确认架构、接口、状态机和降级策略是否能支撑 AC 与 P0 用例。' },
    { label: '前置上下文', value: '模块路径、接口和部署边界必须来自 Project Wiki、repo wiki、源码或明确假设。' },
  ], [
    '架构边界是否清楚，接口字段是否足够实现。',
    '权限、降级、观测和回滚是否完整。',
    '技术方案是否能解释所有 P0 测试风险。',
  ], [
    await mermaidDiagram('核心能力架构和数据流', `flowchart TB
  A["前端页面"] --> B["领域 UI 适配层"]
  B --> C["聚合 API"]
  C --> D["核心记录 / 数据 / 资源 / 风控"]
  C --> E["分析 / 审计 / 灰度"]`),
    await componentizedSections(tech, ['ER 图']),
  ], summaryList('技术评审锚点', [
    '核心架构应把前端展示、领域服务、状态事件、后台处理和指标评估分清边界。',
    '接口覆盖详情/估算、状态时间线、后台处理、支持证据和指标看板。',
    '权限按业务参与方、支持/风控、运营/管理员隔离。',
    '降级策略要求辅助能力不可用时不破坏主链路和存量记录处理。',
  ]) + await componentizedSections(tech, ['模块范围', 'API 汇总表', 'API 接口详情', '状态流转', '错误处理和降级', '权限', '发布计划', '回滚计划', '备选方案', '追踪关系']), tech),
  await tab('development-plan', stageStatus('development-plan', Boolean(plan)), '开发计划', [
    { label: '为什么看', value: '把技术方案拆成可执行、可验证、可并行或不可并行的任务。' },
    { label: '谁来评审', value: '研发负责人、QA、产品、项目负责人。' },
    { label: '要做的决策', value: '确认任务顺序、测试先行点、验证命令、并行边界和回滚任务是否足够清楚。' },
    { label: '前置上下文', value: '开发计划仍受审批门禁约束，不能跳过 Project Wiki、PRD、原型、测试和技术方案审批。' },
  ], [
    '任务是否小到可以独立实现和评审。',
    '测试先行点、验证命令、并行边界是否明确。',
    '开发前置审批门禁是否被保留。',
  ], [
    await mermaidDiagram('开发任务顺序和并行边界', `flowchart LR
  A["TASK-001 合约"] --> B["TASK-002 报价与风控"]
  B --> C["TASK-003 API 合约"]
  C --> D["TASK-004 至 TASK-007 主链路"]
  D --> E["TASK-008 至 TASK-012 履约/争议/观测"]
  E --> F["TASK-013 / TASK-014 发布准备"]`),
  ], summaryList('开发评审锚点', [
    '里程碑应覆盖合约、关键界面或接口、后台处理、观测和发布准备。',
    '任务必须包含测试先行点、验证命令和回滚要求。',
    '可并行任务必须有清晰 ownership、顺序边界和冲突处理方式。',
    '开发前必须保留 Project Wiki、PRD、原型、测试、技术方案、开发计划审批门禁。',
  ]) + await componentizedSections(plan, ['里程碑', '任务计划', '并行边界', '验证命令', '评审门禁', '回滚任务', '追踪关系']), plan),
  await tab('start-implement', stageStatus('start-implement', Boolean(startImplement)), '开工', [
    { label: '为什么看', value: '在真正写代码前确认审批、工作树、任务 ownership、TDD 入口和执行模式。' },
    { label: '谁来评审', value: '研发负责人、QA、产品、发布负责人和需要参与实现的 owner。' },
    { label: '要做的决策', value: '确认是否可以开工，以及使用 single 还是 multi-subagent 模式。' },
    { label: '前置上下文', value: '开工必须读取 Project Wiki、技术方案、测试用例、开发计划和当前工作树状态。' },
  ], [
    'Project Wiki、PRD、原型、测试、技术方案和开发计划是否都已批准或明确不适用。',
    '开发计划是否有明确文件范围、验证命令、TDD 检查点和回滚说明。',
    '是否存在工作树风险、Project Wiki/repo wiki 冲突或需要用户批准的执行模式。',
  ], [
    await mermaidDiagram('开工门禁', `flowchart LR
  A["读取批准产物"] --> B["检查 Project Wiki / repo wiki"]
  B --> C["检查工作树和文件 ownership"]
  C --> D["确认 TDD 和验证命令"]
  D --> E{"推荐执行模式"}
  E --> F["等待用户批准"]`),
  ], summaryList('开工检查锚点', [
    '不得在上游产物未批准时开始实现。',
    '不得在 Project Wiki、repo wiki、源码或开发计划冲突时继续推荐开工。',
    '推荐 multi-subagent 或 single 后必须等待用户确认，除非用户同句明确批准。',
    '开工结论和执行模式批准应回写到本 tab 或 Develop tab。',
  ]) + await componentizedSections(startImplement || plan, ['开工结论', '审批门禁', '工作树', '执行模式', '评审门禁', '并行边界', '验证命令', '风险', '待确认']), startImplementMd),
  await tab('develop', stageStatus('develop', Boolean(develop)), '开发执行', [
    { label: '为什么看', value: '说明为什么当前还不能进入实现，以及开发完成后应该回写哪些证据。' },
    { label: '谁来评审', value: '研发负责人、产品、QA、发布负责人。' },
    { label: '要做的决策', value: '确认上游产物全部批准后才启动开发，且开发结果必须有验证证据。' },
    { label: '前置上下文', value: '当前 Project Wiki、PRD、原型、测试用例、技术方案和开发计划仍是草稿。' },
  ], [
    'Project Wiki、PRD、原型、测试用例、技术方案、开发计划全部批准前不得实现。',
    '开发生成后必须回写修改文件、测试和验证证据。',
  ], [
    await mermaidDiagram('开发执行门禁', `flowchart LR
  A["Project Wiki 批准"] --> B["PRD 批准"]
  B --> C["原型批准"]
  C --> D["测试批准"]
  D --> E["技术方案批准"]
  E --> F["开发计划批准"]
  F --> G["开始实现"]`),
  ], summaryList(develop ? '开发执行记录锚点' : '当前状态', develop ? [
    '区分 demo 产物修复和真实业务实现，避免把文档/看板修复误写成业务功能完成。',
    '记录本轮实际修改、验证命令和仍然禁止宣称的内容。',
    '真实业务开发完成后必须回写文件变更、测试、验证证据、安全检查和回滚说明。',
  ] : [
    '开发执行未生成，因为上游产物仍是草稿。',
    '审批完成后才允许运行开发命令。',
    '开发完成后必须回写文件变更、测试、验证证据和回滚说明。',
  ]) + (develop
    ? await componentizedSections(develop, ['当前结论', '执行记录', '验证证据', '变更范围', '风险', '回滚', '待确认'])
    : `<p>当前未进入开发。审批完成后执行 <code>$product:develop ${escapeHtml(root)}</code>。</p>`), developMd),
].join('\n');

/* c8 ignore start */
const reviewBoardScript = `(() => {
  const root = document.querySelector('main[data-product-title]');
  const tabs = [...document.querySelectorAll('.tab')];
  const panels = [...document.querySelectorAll('.panel')];
  const ids = new Set(tabs.map((tab) => tab.dataset.tab));
  const productTitle = root?.dataset.productTitle || '产品工作流需求';
  const defaultStage = root?.dataset.defaultStage || 'clarify';
  const stageLabels = {
    clarify: '问题澄清',
    'project-wiki': 'Project Wiki',
    prd: 'PRD',
    prototype: '原型',
    'test-cases': '测试用例',
    'test-automation': '自动化测试计划',
    'technical-solution': '技术方案',
    'development-plan': '开发计划',
    'start-implement': '开工',
    develop: '开发执行',
  };
  function resolveStage(id) {
    if (ids.has(id)) return { stage: id, target: null };
    const target = id ? document.getElementById(id) : null;
    const panel = target?.closest('.panel');
    return { stage: panel?.id || (ids.has(defaultStage) ? defaultStage : 'clarify'), target };
  }
  function activate(id, push) {
    const resolved = resolveStage(id);
    const next = resolved.stage;
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === next)));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === next));
    const label = stageLabels[next] || next;
    document.title = productTitle + ' - ' + label;
    const currentStageLabel = document.getElementById('current-stage-label');
    if (currentStageLabel) currentStageLabel.textContent = '当前阶段：' + label;
    if (push) history.replaceState(null, '', '#' + (id || next));
    if (resolved.target) {
      window.requestAnimationFrame(() => {
        resolved.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        resolved.target.focus({ preventScroll: true });
      });
    }
  }
  tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.tab, true)));
  document.querySelectorAll('.key-review-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.dataset.targetId;
      if (!targetId) return;
      event.preventDefault();
      activate(targetId, true);
    });
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    const buttons = [...panel.querySelectorAll('.view-button')];
    const panes = [...panel.querySelectorAll('.view-pane')];
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        buttons.forEach((item) => item.setAttribute('aria-selected', String(item === button)));
        panes.forEach((pane) => {
          pane.hidden = pane.dataset.viewPane !== view;
        });
      });
    });
  });
  document.querySelectorAll('.component-tab').forEach((button) => {
    button.addEventListener('click', () => {
      const component = button.dataset.componentTab;
      const target = button.dataset.componentTarget;
      document.querySelectorAll('[data-component-tab="' + component + '"]').forEach((item) => {
        item.setAttribute('aria-selected', String(item === button));
      });
      document.querySelectorAll('[data-component-pane="' + component + '"]').forEach((pane) => {
        pane.hidden = pane.dataset.componentIndex !== target;
      });
    });
  });
  window.addEventListener('hashchange', () => activate(location.hash.slice(1), false));
  activate(location.hash.slice(1), false);
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        primaryColor: '#f8fbff',
        primaryBorderColor: '#146b5f',
        primaryTextColor: '#17212b',
        lineColor: '#667085',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      },
    });
    window.mermaid.run({ querySelector: '.mermaid' }).catch((error) => console.error(error));
  }
})();`;
/* c8 ignore stop */
const bakedScripts = await inlineBoardScripts(
  '<script src="./mermaid.min.js"></script>\n  <script src="./review-board.js"></script>',
  {
    mermaid: await readBundledScript('mermaid.min.js'),
    baked: reviewBoardScript,
  },
);
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(productTitle)} - 产品工作流评审看板</title>
  <style>
    :root { --ink:#17212b; --muted:#667085; --line:#d8dee8; --soft:#f5f7fa; --surface:#fff; --brand:#146b5f; --blue:#2d6cdf; --warn:#b54708; --ok:#067647; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--ink); background:#eef2f6; }
    header { background:#101828; color:#fff; padding:28px 32px 20px; }
    header h1 { margin:0; font-size:28px; letter-spacing:0; }
    header p { max-width:1120px; color:#cbd5e1; line-height:1.7; }
    main { max-width:1360px; margin:0 auto; padding:18px; }
    .tabs { display:flex; flex-wrap:wrap; gap:8px; position:sticky; top:0; z-index:5; padding:10px 0 14px; background:#eef2f6; }
    .tab { border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:6px; padding:9px 12px; font-weight:750; cursor:pointer; }
    .tab[aria-selected="true"] { background:var(--brand); color:#fff; border-color:var(--brand); }
    .panel { display:none; background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:22px; }
    .panel.active { display:block; }
    .status { display:inline-flex; border:1px solid var(--line); border-radius:999px; padding:5px 10px; font-size:13px; font-weight:750; background:var(--soft); }
    .status.reviewed { color:var(--ok); background:#ecfdf3; border-color:#98d6b3; }
    .status.draft { color:var(--warn); background:#fffaeb; border-color:#f7c98b; }
    .status.blocked { color:var(--warn); background:#fffaeb; border-color:#f7c98b; }
    .status.waived { color:#9a3412; background:#fff7ed; border-color:#fdba74; margin-left:6px; }
    .status.empty { color:var(--muted); }
    h2 { margin:12px 0; font-size:24px; }
    h3 { margin:24px 0 10px; font-size:18px; }
    h4, h5 { margin:18px 0 8px; }
    p, li { line-height:1.65; }
    a { color:var(--blue); font-weight:750; text-decoration:none; }
    code { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:1px 4px; }
    pre { overflow:auto; background:#f8fafc; color:#17212b; border:1px solid var(--line); border-radius:8px; padding:14px; line-height:1.55; }
    pre code { background:transparent; border:0; color:inherit; padding:0; white-space:pre; }
    table { width:100%; border-collapse:collapse; font-size:14px; margin:12px 0; }
    th, td { text-align:left; vertical-align:top; padding:10px; border-bottom:1px solid #edf0f4; }
    th { color:var(--muted); background:var(--soft); font-weight:750; }
    .context-box { border:1px solid #cfe0f2; background:#f8fbff; border-radius:8px; padding:14px; margin:12px 0 16px; }
    .context-box > strong { display:block; color:var(--brand); margin-bottom:10px; }
    .context-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
    .context-grid div { border:1px solid #dbe5f0; border-radius:8px; background:#fff; padding:10px; }
    .context-grid span { display:block; color:var(--muted); font-size:12px; font-weight:750; margin-bottom:5px; }
    .context-grid p { margin:0; font-size:14px; line-height:1.6; }
    .key-review-box { border:1px solid #a7d3cc; border-left:4px solid var(--brand); background:#f0fbf8; border-radius:8px; padding:14px 16px; margin:12px 0 16px; }
    .key-review-box strong { display:block; color:var(--brand); margin-bottom:6px; }
    .key-review-box p { margin:0; font-size:15px; line-height:1.65; }
    .key-review-question { font-weight:750; color:var(--ink); }
    .key-review-action { color:#344054; margin-top:6px !important; }
    .key-review-link { display:inline-flex; align-items:center; margin-top:10px; border:1px solid #a7d3cc; border-radius:6px; background:#fff; padding:7px 10px; color:var(--brand); font-size:14px; font-weight:750; }
    .artifact-body:focus { outline:2px solid rgba(20,107,95,.25); outline-offset:4px; border-radius:8px; }
    .review-box { border-left:4px solid var(--brand); background:#eefaf6; border-radius:6px; padding:12px 14px; margin:12px 0 16px; }
    .summary-box { border:1px solid var(--line); border-radius:8px; background:#fff; padding:14px; margin:14px 0; }
    .summary-box strong { color:var(--brand); }
    .review-component { border:1px solid var(--line); border-radius:8px; background:#fff; padding:16px; margin:14px 0; overflow:hidden; }
    .component-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:12px; }
    .component-heading h3, .component-heading h4 { margin:0; }
    .component-heading p { margin:0; color:var(--muted); max-width:640px; font-size:14px; }
    .component-intro { border:1px solid #e2e8f0; background:#f8fafc; border-radius:8px; padding:12px; margin:10px 0 12px; }
    .component-intro p { margin:0 0 8px; }
    .component-intro p:last-child { margin-bottom:0; }
    .compact-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:12px 0; }
    .compact-card { border:1px solid #dbe5f0; border-radius:8px; background:#fbfcfe; padding:11px; }
    .compact-card span, .review-card-grid span { display:block; color:var(--muted); font-size:12px; font-weight:750; margin-bottom:5px; }
    .compact-card p, .review-card-grid p { margin:0; }
    .table-component { background:#fbfcfe; }
    .component-tabs { display:flex; gap:8px; flex-wrap:wrap; padding:6px; border:1px solid var(--line); border-radius:8px; background:#fff; margin:12px 0; }
    .component-tab { border:1px solid transparent; border-radius:6px; background:transparent; padding:7px 10px; color:var(--ink); font-weight:750; cursor:pointer; }
    .component-tab[aria-selected="true"] { background:var(--brand); color:#fff; border-color:var(--brand); }
    .component-pane[hidden] { display:none; }
    .pane-summary { display:flex; justify-content:space-between; gap:12px; align-items:center; border:1px solid #dbe5f0; border-radius:8px; background:#fff; padding:10px 12px; margin-bottom:10px; }
    .pane-summary span { color:var(--muted); font-size:13px; }
    .review-card-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .review-card { border:1px solid #dbe5f0; border-radius:8px; background:#fff; padding:12px; }
    .review-card > strong { display:block; color:var(--brand); margin-bottom:10px; }
    .review-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
    .review-card-grid div { border-top:1px solid #edf0f4; padding-top:8px; }
    .group-label { display:inline-flex; margin:0 0 6px; border:1px solid #dbe5f0; border-radius:999px; background:#f8fafc; color:var(--muted); padding:3px 8px; font-size:12px; font-weight:750; }
    .flat-table { display:grid; gap:0; border:1px solid #dbe5f0; border-radius:8px; overflow:hidden; background:#fff; }
    .flat-table-head, .flat-table-row { display:grid; grid-template-columns:minmax(120px,.8fr) repeat(var(--flat-cols, 3), minmax(150px,1fr)); }
    .flat-table-head { background:#f8fafc; color:var(--muted); font-size:12px; font-weight:800; }
    .flat-table-head span { padding:10px; border-right:1px solid #e2e8f0; }
    .flat-table-row { border-top:1px solid #edf0f4; }
    .flat-table-key, .flat-table-cell { min-width:0; padding:10px; border-right:1px solid #edf0f4; }
    .flat-table-key { background:#fbfcfe; }
    .flat-table-key span, .flat-table-cell span { display:none; color:var(--muted); font-size:12px; font-weight:750; margin-bottom:5px; }
    .flat-table-key strong { color:var(--brand); }
    .flat-table-cell p { margin:0; line-height:1.55; }
    .visual-section { border:1px solid var(--line); border-radius:8px; background:#fff; padding:16px; margin:14px 0; overflow-x:auto; }
    .visual-section h3:first-child, .visual-section h4:first-child { margin-top:0; }
    .card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .info-card { border:1px solid var(--line); border-radius:8px; background:#fbfcfe; padding:13px; min-height:110px; }
    .info-card strong { color:var(--brand); display:block; margin-bottom:8px; }
    .info-card p { margin:0; }
    .view-switch { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 16px; padding:6px; border:1px solid var(--line); border-radius:8px; background:#f8fafc; width:fit-content; max-width:100%; }
    .view-button { border:1px solid transparent; border-radius:6px; padding:8px 12px; background:transparent; color:var(--ink); font-weight:750; cursor:pointer; }
    .view-button[aria-selected="true"] { background:var(--brand); color:#fff; border-color:var(--brand); }
    .view-pane[hidden] { display:none; }
    .ai-source { max-height:72vh; }
    .diagram { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfcfe; margin:14px 0; overflow-x:auto; }
    .diagram-title { margin:0 0 10px; color:var(--brand); font-weight:800; }
    .flow { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(130px,1fr); gap:22px; align-items:center; min-width:820px; }
    .node { position:relative; border:1px solid #b7d8d2; background:#effaf7; border-radius:8px; padding:12px; text-align:center; font-weight:750; }
    .node.blue { border-color:#b9cdfb; background:#eef4ff; }
    .node.warn { border-color:#f7c98b; background:#fffaeb; }
    .flow .node:not(:last-child)::after { content:"→"; position:absolute; right:-19px; top:50%; transform:translateY(-50%); color:var(--muted); font-weight:800; }
    .mermaid-rendered { background:#fff; }
    .mermaid-svg { overflow:auto; border:1px solid #edf0f4; border-radius:8px; background:#fff; padding:8px; }
    .mermaid-svg svg { display:block; min-width:0; width:100%; max-width:1180px; height:auto; margin:0 auto; }
    @media (min-width:901px) { .mermaid-svg svg[aria-roledescription="sequence"], .mermaid-svg svg[aria-roledescription="er"] { min-width:900px; max-width:none; } }
    .mermaid-error { border-color:#f7c98b; background:#fffaeb; }
    .rich-diagram { background:#fff; }
    .diagram-svg { display:block; width:100%; min-width:860px; height:auto; background:#fff; border:1px solid #edf0f4; border-radius:8px; }
    .artifact-body { margin-top:18px; }
    .markdown-preview { border:1px solid #b7d8d2; border-radius:8px; background:#f7fffc; padding:16px; margin:22px 0 0; }
    .markdown-preview .component-heading { border-bottom:1px solid #d9eee9; padding-bottom:12px; }
    .markdown-preview-body { background:#fff; border:1px solid #dbe5f0; border-radius:8px; padding:16px; overflow:auto; }
    .markdown-preview-body h2:first-child, .markdown-preview-body h3:first-child { margin-top:0; }
    .markdown-preview-body table { min-width:760px; }
    .markdown-preview-body pre { background:#0f172a; color:#e5e7eb; border-color:#1e293b; }
    @media (max-width:900px) { header{padding:22px 16px;} main{padding:12px;} .context-grid{grid-template-columns:1fr;} .component-heading{display:block;} .component-heading p{margin-top:8px;} .compact-card-grid,.review-card-list,.review-card-grid{grid-template-columns:1fr;} .flat-table{border:0; background:transparent; gap:10px;} .flat-table-head{display:none;} .flat-table-row{display:grid; grid-template-columns:1fr; border:1px solid #dbe5f0; border-radius:8px; background:#fff; overflow:hidden;} .flat-table-key,.flat-table-cell{border-right:0; border-top:1px solid #edf0f4;} .flat-table-key{border-top:0;} .flat-table-key span,.flat-table-cell span{display:block;} .component-tabs{flex-wrap:nowrap; overflow-x:auto;} .component-tab{white-space:nowrap;} .flow{grid-auto-flow:row; min-width:0;} .flow .node:not(:last-child)::after{content:"↓"; position:static; transform:none; display:block; margin-top:8px;} .card-grid{grid-template-columns:1fr;} table{font-size:13px;} }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(productTitle)} - 产品工作流评审看板</h1>
    <p>本页面由 product-workflow skill 的本地生成器读取 Markdown/HTML 产物生成。每个 tab 包含评审重点、图示和完整产物内容，便于直接开评审会。</p>
    <p id="current-stage-label">当前阶段：${escapeHtml(stageLabelOf(defaultStage))}</p>
  </header>
  <main data-product-title="${escapeHtml(productTitle)}" data-default-stage="${escapeHtml(defaultStage)}">
    <nav class="tabs" aria-label="产品工作流 tabs">
      ${[
        ['clarify', '问题澄清'],
        ['project-wiki', 'Project Wiki'],
        ['prd', 'PRD'],
        ['prototype', '原型'],
        ['test-cases', '测试用例'],
        ['test-automation', '自动化测试计划'],
        ['technical-solution', '技术方案'],
        ['development-plan', '开发计划'],
        ['start-implement', '开工'],
        ['develop', '开发执行'],
      ].map(([id, label]) => `<button class="tab" data-tab="${id}" aria-selected="${id === defaultStage}">${label}</button>`).join('\n')}
    </nav>
    ${tabs}
  </main>
  ${bakedScripts}
</body>
</html>
`;

/* moved */

const normalizedHtml = html.replace(/[ \t]+$/gm, '');
let historyNote = '首次生成，无上一版可备份';
try {
  const snapshot = await snapshotHistory();
  historyNote = snapshot.skipped
    ? '首次生成，无上一版可备份'
    : `已备份上一版到 index.prev.html 与 history/${snapshot.id}`;
} catch (error) {
  historyNote = `历史备份失败：${error.message || String(error)}（看板仍会生成）`;
}
await relocateRootBoardShells();
await fs.mkdir(path.join(root, BOARD_DIR), { recursive: true });
await fs.writeFile(path.join(root, BOARD_DIR, 'index.html'), normalizedHtml);
await removeBoardSidecars();
console.log(`已生成 ${path.join(root, BOARD_DIR, 'index.html')}`);
console.log('看板已内联 mermaid 与脚本（打开 .review-board/index.html 即可出图，不依赖旁路 js，也不依赖 Playwright）');
console.log(historyNote);

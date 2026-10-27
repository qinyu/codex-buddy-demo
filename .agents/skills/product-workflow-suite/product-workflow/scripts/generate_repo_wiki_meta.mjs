#!/usr/bin/env node
// 从 docs/repo-wiki 与 docs/project-wiki 现有 Markdown 派生 catalogue.json 与 _meta/status.md。
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WIKI_DIRS = [
  { rel: path.join('docs', 'repo-wiki'), title: 'Repo Wiki' },
  { rel: path.join('docs', 'project-wiki'), title: 'Project Wiki' },
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir, root, out = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file, root, out);
    else if (entry.isFile() && entry.name.endsWith('.md') && path.relative(root, file) !== '_meta/status.md') out.push(file);
  }
  return out;
}

function titleOf(text, fallback) {
  return text.match(/^#\s+(.+)$/m)?.[1].trim() || fallback;
}

function gitCommit(root) {
  const result = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'non-git';
}

export async function generateWikiMeta(wiki, options = {}) {
  const files = (await walk(wiki, wiki)).sort();
  const pages = [];
  for (const file of files) {
    const rel = path.relative(wiki, file).split(path.sep).join('/');
    const text = await fs.readFile(file, 'utf8');
    pages.push({ path: rel, title: titleOf(text, path.basename(rel, '.md')) });
  }
  const commit = options.commit || 'non-git';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const title = options.title || 'Wiki';
  const catalogue = { title, source_commit: commit, generated_at: generatedAt, pages };
  await fs.mkdir(path.join(wiki, '_meta'), { recursive: true });
  await fs.writeFile(path.join(wiki, 'catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`);
  const status = [
    `# ${title} 状态`,
    '',
    `- 源码 commit：\`${commit}\``,
    `- 生成时间：\`${generatedAt}\``,
    `- 页面数：${pages.length}`,
    '- freshness：后续用当前 `git rev-parse HEAD` 与源码 commit 比较；不一致时 Wiki 只作导航。',
    '',
  ].join('\n');
  await fs.writeFile(path.join(wiki, '_meta', 'status.md'), status);
  return { wiki, title, commit, pages };
}

export async function generateRepoWikiMeta(projectRoot) {
  const root = path.resolve(projectRoot);
  const commit = gitCommit(root);
  const generatedAt = new Date().toISOString();
  const wikis = [];
  for (const spec of WIKI_DIRS) {
    const wiki = path.join(root, spec.rel);
    if (!(await exists(wiki))) continue;
    wikis.push(await generateWikiMeta(wiki, { title: spec.title, commit, generatedAt }));
  }
  if (!wikis.length) throw new Error(`未找到 docs/repo-wiki 或 docs/project-wiki：${root}`);
  return { root, commit, wikis, pages: wikis.flatMap((item) => item.pages) };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write('用法：node generate_repo_wiki_meta.mjs <project-root>\n');
    return 0;
  }
  const target = argv.find((arg) => !arg.startsWith('--'));
  if (!target) {
    process.stderr.write('用法：node generate_repo_wiki_meta.mjs <project-root>\n');
    return 1;
  }
  const result = await generateRepoWikiMeta(target);
  process.stdout.write(`generated ${result.pages.length} pages in ${result.wikis.length} wiki(s)\n`);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

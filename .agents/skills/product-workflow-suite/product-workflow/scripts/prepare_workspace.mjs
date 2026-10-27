#!/usr/bin/env node
// 产品经理工作区：探测现有 checkout，登记缺哪个仓。
// 拉仓（clone）由 Setup 在授权后执行，本脚本不 clone。也不装依赖、不建图谱。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function usage() {
  return `用法：
  node prepare_workspace.mjs <workspace-dir> [--repo <git-url>] [--branch <name>] [--dir <subdir>]

只探测与登记；clone 由 Setup 在授权后执行。
  node prepare_workspace.mjs <workspace-dir> --repos <workspace.json>`;
}

export function parseArgs(argv) {
  const args = { workspace: '', repo: '', branch: '', dir: '', repos: '', help: false };
  const rest = [...argv];
  while (rest.length) {
    const token = rest.shift();
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--repo') args.repo = rest.shift() || '';
    else if (token === '--branch') args.branch = rest.shift() || '';
    else if (token === '--dir') args.dir = rest.shift() || '';
    else if (token === '--repos') args.repos = rest.shift() || '';
    else if (!token.startsWith('--') && !args.workspace) args.workspace = token;
    else throw new Error(`未知参数：${token}\n${usage()}`);
  }
  return args;
}

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function listVisible(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name !== '.DS_Store');
}

function isGitRoot(dir) {
  const gitPath = path.join(dir, '.git');
  if (!exists(gitPath)) return false;
  try {
    const st = fs.lstatSync(gitPath);
    if (st.isDirectory()) return true;
    if (st.isFile()) return /^gitdir:/m.test(fs.readFileSync(gitPath, 'utf8'));
  } catch {
    return false;
  }
  return false;
}

export function parseReposFile(file) {
  return normalizeRepos(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export function slugAlias(value, fallback) {
  const raw = String(value || '').trim() || fallback;
  const slug = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function normalizeRepos(data) {
  let rows = [];
  if (Array.isArray(data)) rows = data;
  else if (Array.isArray(data?.repositories)) rows = data.repositories;
  else if (data?.repositories && typeof data.repositories === 'object') {
    rows = Object.entries(data.repositories).map(([alias, spec]) => ({
      alias,
      url: spec.url || spec.repo || '',
      path: spec.path || alias,
      branch: spec.branch || spec.baseBranch || '',
    }));
  } else {
    throw new Error('repos 须是 {repositories:[]} 或 workspace.json 的 repositories 对象');
  }
  return rows.map((row, index) => {
    const alias = slugAlias(row.alias || row.name, `repo${index + 1}`);
    return {
      alias,
      url: String(row.url || row.repo || '').trim(),
      path: String(row.path || alias).trim() || alias,
      branch: String(row.branch || row.baseBranch || '').trim(),
    };
  });
}

export function workspaceDocument({ name = '', repositories = [] } = {}) {
  const specs = normalizeRepos({ repositories });
  const body = {
    version: '1',
    name: name || path.basename(process.cwd()) || 'workspace',
    repositories: {},
  };
  for (const spec of specs) {
    body.repositories[spec.alias] = {
      url: spec.url,
      path: spec.path,
      branch: spec.branch || 'main',
    };
  }
  return `${JSON.stringify(body, null, 2)}\n`;
}

function cloneTarget(workspace, subdir) {
  if (!subdir) return workspace;
  if (path.isAbsolute(subdir) || subdir.split(/[\\/]/).includes('..')) {
    throw new Error(`--dir 只能是工作区下的相对目录：${subdir}`);
  }
  return path.join(workspace, subdir);
}

export function inspectWorkspace(workspaceDir) {
  const workspace = path.resolve(workspaceDir);
  const existsDir = exists(workspace);
  const entries = existsDir ? listVisible(workspace) : [];
  const empty = !existsDir || entries.length === 0;
  return {
    workspace,
    exists: existsDir,
    empty,
    git: isGitRoot(workspace),
    entries,
  };
}

export function prepareWorkspace(workspaceDir, options = {}) {
  const inspect = inspectWorkspace(workspaceDir);
  const specs = options.repos
    || (options.reposFile ? parseReposFile(options.reposFile) : null);
  if (Array.isArray(specs) && specs.length) {
    fs.mkdirSync(inspect.workspace, { recursive: true });
    const planned = [];
    for (const spec of specs) {
      const target = cloneTarget(inspect.workspace, spec.path || spec.alias);
      if (isGitRoot(target)) {
        planned.push({ ...spec, action: 'skipped-existing-git', target, git: true });
        continue;
      }
      if (exists(target) && listVisible(target).length) {
        planned.push({ ...spec, action: 'skipped-nonempty', target, git: false });
        continue;
      }
      // Setup授权后执行拉仓；这里只登记待拉与原始url/branch
      planned.push({ ...spec, action: 'awaiting-authorized-clone', target, git: false });
    }
    const handoff = planned.filter((row) => row.action === 'awaiting-authorized-clone');
    return {
      action: handoff.length === planned.length ? 'awaiting-authorized-clone' : 'multi',
      workspace: inspect.workspace,
      git: inspect.git,
      repos: planned,
    };
  }
  if (inspect.git) {
    return { action: 'skipped-existing-git', ...inspect, target: inspect.workspace };
  }
  if (!inspect.empty) {
    return { action: 'skipped-nonempty', ...inspect, target: inspect.workspace };
  }
  // 空目录且给了地址：登记待拉，不自己 clone
  const target = cloneTarget(inspect.workspace, options.dir);
  return {
    action: options.repo ? 'awaiting-authorized-clone' : 'need-repo',
    workspace: inspect.workspace,
    target,
    repo: options.repo || '',
    branch: options.branch || '',
    git: false,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (!args.workspace) {
    process.stderr.write(`${usage()}\n`);
    return 1;
  }
  const result = prepareWorkspace(args.workspace, {
    repo: args.repo,
    branch: args.branch,
    dir: args.dir,
    reposFile: args.repos,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
// 探测统一 Wiki 的 CodeGraph 分支。只读，不安装、不建图谱；query_ready 仅表示可尝试查询。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

const DEFAULT_PROVIDER = 'codegraph';

const SKILL_RELATIVE_PATHS = [
  '.cursor/skills/wiki/SKILL.md',
  '.codex/skills/wiki/SKILL.md',
  '.claude/skills/wiki/SKILL.md',
  '.agents/skills/wiki/SKILL.md',
];

const ARTIFACT_RELATIVE_PATHS = [
  'docs/project-wiki/code-wiki-repos.json',
  // 0.8.0 引擎收口为 CodeGraph；旧引擎 .code-review-graph/ 与 graphify-out/ 已移除（见 addons/wiki/references/migrate-legacy.md）。
  '.codegraph/codegraph.db',
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function skillRelativesFor() {
  // skill 名为 wiki；内部 CLI code-wiki 与 provider codegraph 不是 skill 入口。
  return SKILL_RELATIVE_PATHS;
}

export async function detectCodeWiki(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const home = path.resolve(options.home || os.homedir());
  const configPath = path.join(root, '.product-workflow-config.json');
  const config = await readJson(configPath);
  const policy = config?.workflow_policy || {};
  const policyCodeWiki = policy.code_wiki || 'optional';
  const configuredProvider = policy.code_wiki_provider || null;
  const declined = policy.code_exploration === 'user_declined';

  const providerName = configuredProvider || DEFAULT_PROVIDER;
  const relatives = skillRelativesFor();
  const skillCandidates = [...new Set([
    ...relatives.map((rel) => path.join(root, rel)),
    ...relatives.map((rel) => path.join(home, rel)),
  ])];
  const skillPaths = [];
  for (const file of skillCandidates) if (await exists(file)) skillPaths.push(file);

  const artifactHits = [];
  for (const rel of ARTIFACT_RELATIVE_PATHS) {
    const file = path.join(root, rel);
    if (await exists(file)) artifactHits.push(rel);
  }
  const reposManifest = path.join(root, 'docs/project-wiki/code-wiki-repos.json');
  const reposExists = await exists(reposManifest);

  const graphReady = artifactHits.includes('.codegraph/codegraph.db');
  const detected = skillPaths.length > 0
    || artifactHits.length > 0
    || Boolean(configuredProvider);
  return {
    detected,
    graph_ready: graphReady,
    query_ready: graphReady && skillPaths.length > 0 && !declined && policyCodeWiki !== 'not_applicable',
    provider: detected ? (configuredProvider || DEFAULT_PROVIDER) : null,
    policy: policyCodeWiki,
    code_exploration: policy.code_exploration || null,
    declined,
    source: [
      ...(configuredProvider ? ['workflow_policy'] : []),
      ...(skillPaths.length ? ['skill'] : []),
      ...(artifactHits.length ? ['artifacts'] : []),
    ],
    skill_path: skillPaths[0] || null,
    skill_dir: skillPaths[0] ? path.dirname(skillPaths[0]) : null,
    artifact_paths: artifactHits,
    repos_manifest: reposExists ? reposManifest : null,
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write('用法：node detect_code_wiki.mjs [project-root]\n');
    return 0;
  }
  const root = argv.find((arg) => !arg.startsWith('--')) || process.cwd();
  const result = await detectCodeWiki(root);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

const isMain = process.argv[1] && (() => {
  // realpath 双侧归一：脚本路径或调用路径经符号链接（如 macOS /tmp → /private/tmp）时仍能命中主模块判断。
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
})();
if (isMain) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

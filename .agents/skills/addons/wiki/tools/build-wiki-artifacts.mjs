import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalReferences } from './local-skill-references.mjs';
import { suiteMetadata } from './skill-metadata.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const EXCLUDED = new Set(['node_modules', '.venv', '__pycache__', '.pytest_cache', '.coverage', '.git', 'coverage', 'tests', 'evals', 'package.json']);

function copyFiltered(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    if (EXCLUDED.has(name) || name.startsWith('.coverage.')) continue;
    const from = path.join(source, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyFiltered(from, to);
    else fs.copyFileSync(from, to);
  }
}

function writeChecksum(dir) {
  const files = [];
  function walk(current) {
    for (const name of fs.readdirSync(current).sort()) {
      if (name === 'SHA256SUMS.txt') continue;
      const abs = path.join(current, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else files.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  }
  walk(dir);
  const sums = files.map((rel) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex')}  ${rel}`);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
}

function buildOne(sourceRoot, skill, out, version) {
  const source = path.join(sourceRoot, skill);
  if (!fs.existsSync(path.join(source, 'SKILL.md'))) throw new Error(`缺少声明内容：${skill}`);
  const dest = path.join(out, skill);
  copyFiltered(source, dest);
  fs.writeFileSync(path.join(dest, 'VERSION'), `${version}\n`);
  writeChecksum(dest);
  return dest;
}

export function buildWikiArtifacts({ source = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), out, version: requestedVersion } = {}) {
  const skill = path.join(source, 'wiki');
  if (!fs.existsSync(path.join(skill, 'SKILL.md'))) throw new Error('缺少声明内容：wiki');
  assertLocalReferences(skill);
  const { version } = suiteMetadata(source, ['wiki'], 'wiki', requestedVersion);
  const paths = {
    'wiki': buildOne(source, 'wiki', out, version),
  };
  const probe = `import fs from 'node:fs';
import path from 'node:path';
export function probeCodeWiki(project) {
  const graph = fs.existsSync(path.join(project, '.codegraph', 'codegraph.db'));
  const skill = fs.existsSync(path.join(project, '.agents', 'skills', 'wiki', 'SKILL.md'));
  return { queryReady: graph && skill, graphReady: graph, skillReady: skill };
}
`;
  fs.mkdirSync(path.join(paths['wiki'], 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(paths['wiki'], 'scripts', 'probe-code-wiki.mjs'), probe);
  writeChecksum(paths['wiki']);
  return { version, paths };
}

export function probeWiki({ project, skillDir, upgrade = false }) {
  const knowledge = path.join(project, 'docs', 'repo-wiki', 'index.md');
  const graph = fs.existsSync(path.join(project, '.codegraph', 'codegraph.db'));
  const skill = fs.existsSync(path.join(project, '.agents', 'skills', 'wiki', 'SKILL.md'));
  return { queryReady: graph && skill, preserved: upgrade && fs.existsSync(knowledge), skillDir };
}

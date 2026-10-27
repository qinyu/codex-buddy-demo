import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalReferences } from './local-skill-references.mjs';
import { suiteMetadata } from './skill-metadata.mjs';

const ROOT = path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))));
const EXCLUDED = new Set(['node_modules', 'coverage', 'tests', 'evals', 'package.json', 'unit-test-init', 'unit-test-generator']);

function copyFiltered(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    if (EXCLUDED.has(name)) continue;
    const from = path.join(source, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyFiltered(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function planGitHook({ files = [], scripts = [], packageHooks, simpleGitHooks, manager }) {
  const husky = files.includes('.husky') || (packageHooks && typeof packageHooks === 'object');
  const current = files.includes('lefthook.yml') ? 'lefthook'
    : files.includes('.pre-commit-config.yaml') ? 'pre-commit'
    : husky ? 'husky'
    : simpleGitHooks && typeof simpleGitHooks === 'object' ? 'simple-git-hooks'
    : files.includes('.githooks') ? 'git-core-hooksPath'
    : null;
  if (manager && current && manager !== current) return { outcome: 'conflict', manager: current };
  const missing = ['lint'].filter((name) => !scripts.includes(name));
  return {
    outcome: missing.length ? 'missing' : 'ready',
    missing,
    manager: current || 'lefthook',
    testGate: scripts.includes('test') ? 'pre-push' : 'unit-test-init',
  };
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

export function buildGitHookArtifact({ source = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))), out, version: requestedVersion } = {}) {
  const skill = path.join(source, 'git-hook-init');
  if (!fs.existsSync(path.join(skill, 'SKILL.md'))) throw new Error('缺少声明内容');
  assertLocalReferences(skill);
  const { version } = suiteMetadata(source, ['git-hook-init'], 'git-hook', requestedVersion);
  const dest = path.join(out, 'git-hook-init');
  copyFiltered(skill, dest);
  fs.writeFileSync(path.join(dest, 'VERSION'), `${version}\n`);
  writeChecksum(dest);
  return { version, path: dest };
}

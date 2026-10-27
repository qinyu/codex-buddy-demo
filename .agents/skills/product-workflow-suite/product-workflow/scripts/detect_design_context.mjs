#!/usr/bin/env node
// 探测项目是否已采用 impeccable；只读，不安装、不修改外部 skill。
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_RELATIVE_PATHS = [
  '.cursor/skills/impeccable/SKILL.md',
  '.codex/skills/impeccable/SKILL.md',
  '.claude/skills/impeccable/SKILL.md',
  '.agents/skills/impeccable/SKILL.md',
];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function detectDesignContext(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  const home = path.resolve(options.home || os.homedir());
  const productPath = path.join(root, 'PRODUCT.md');
  const designPath = path.join(root, 'DESIGN.md');
  const skillCandidates = [...new Set([
    ...SKILL_RELATIVE_PATHS.map((rel) => path.join(root, rel)),
    ...SKILL_RELATIVE_PATHS.map((rel) => path.join(home, rel)),
  ])];
  const skillPaths = [];
  for (const file of skillCandidates) if (await exists(file)) skillPaths.push(file);
  const productExists = await exists(productPath);
  const designExists = await exists(designPath);
  const detected = skillPaths.length > 0 || productExists || designExists;
  return {
    detected,
    source: [
      ...(skillPaths.length ? ['skill'] : []),
      ...(productExists ? ['PRODUCT.md'] : []),
      ...(designExists ? ['DESIGN.md'] : []),
    ],
    skill_path: skillPaths[0] || null,
    product_path: productExists ? productPath : null,
    design_path: designExists ? designPath : null,
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write('用法：node detect_design_context.mjs [project-root]\n');
    return 0;
  }
  const root = argv.find((arg) => !arg.startsWith('--')) || process.cwd();
  const result = await detectDesignContext(root);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function ensureMermaid(dir) {
  if (!dir) {
    throw new Error('用法：node ensure_mermaid.mjs <product-workflow-dir>');
  }
  const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'mermaid.min.js');
  const dest = path.join(path.resolve(dir), 'mermaid.min.js');
  await fs.copyFile(src, dest);
  console.log(`已复制 mermaid.min.js → ${dest}（不要用 Playwright 出图）`);
  return dest;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  ensureMermaid(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function suiteTestFiles(root = process.cwd()) {
  const testsDir = path.join(root, 'tests');
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name.endsWith('.test.mjs') || entry.name === 'eval_basic.mjs') {
        files.push(path.relative(root, full));
      }
    }
  };
  visit(testsDir);
  return files;
}

export function isSuiteTestFilesCli(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  if (!argv1) return false;
  return metaUrl === pathToFileURL(path.resolve(argv1)).href;
}

if (isSuiteTestFilesCli()) {
  process.stdout.write(`${suiteTestFiles().join('\n')}\n`);
}

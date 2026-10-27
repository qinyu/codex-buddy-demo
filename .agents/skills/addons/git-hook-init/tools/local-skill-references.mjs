import fs from 'node:fs';
import path from 'node:path';

export function missingLocalReferences(skillDir) {
  const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
  const refs = [...skill.matchAll(/`((?:references|assets)\/[^`*]+)`/g)].map((match) => match[1]);
  return [...new Set(refs)].filter((ref) => !fs.existsSync(path.join(skillDir, ref)));
}

export function assertLocalReferences(skillDir) {
  const missing = missingLocalReferences(skillDir);
  if (missing.length) throw new Error(`未声明引用：${missing[0]}：${path.basename(skillDir)}`);
}

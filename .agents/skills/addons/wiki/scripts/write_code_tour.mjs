import fs from 'node:fs';
import path from 'node:path';

const LIMITS = { 'new-joiner': [9, 13] };

export function writeCodeTour({ project, persona = 'new-joiner', focus = 'request', readFile = fs.readFileSync } = {}) {
  const wiki = path.join(project, 'docs/repo-wiki');
  readFile(path.join(wiki, 'index.md'), 'utf8');
  const catalogue = JSON.parse(readFile(path.join(wiki, 'catalogue.json'), 'utf8'));
  const map = readFile(path.join(wiki, 'codemaps', `${focus}.md`), 'utf8');
  const allowed = new Set(catalogue.entries.flatMap((entry) => entry.source_files || []));
  const anchors = [...map.matchAll(/([\w./-]+\.\w+):(\d+)/g)]
    .map((match) => ({ file: match[1], line: Number(match[2]) }))
    .filter((anchor) => allowed.has(anchor.file) && lineExists(project, anchor, readFile));
  if (!anchors.length) throw new Error('代码图没有可核实行号');
  const [minimum, maximum] = LIMITS[persona] || [7, 11];
  const phases = ['orientation', 'module map', 'core path', 'gotcha', 'next move'];
  const steps = [];
  for (let index = 0; steps.length < minimum && index < maximum * anchors.length; index += 1) {
    const anchor = anchors[index % anchors.length];
    steps.push({ ...anchor, phase: phases[index % phases.length], order: index + 1 });
  }
  if (steps.length < minimum || steps.length > maximum) throw new Error(`${persona} 步数须为 ${minimum}-${maximum}`);
  const tour = { title: `${persona} ${focus}`, steps };
  const file = path.join(project, '.tours', `${persona}-${focus}.tour`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(tour, null, 2)}\n`);
  return { file, steps: anchors.length };
}

function lineExists(project, anchor, readFile) {
  const lines = readFile(path.join(project, anchor.file), 'utf8').split(/\r?\n/);
  return anchor.line >= 1 && anchor.line <= lines.length && lines[anchor.line - 1] !== undefined;
}

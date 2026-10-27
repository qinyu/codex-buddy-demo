import fs from 'node:fs';
import path from 'node:path';

export function requestStageApproval({ slice, stage = 'prd', body, render } = {}) {
  if (!body.includes('## 对抗审查')) throw new Error('请求批准前缺少对抗审查');
  fs.writeFileSync(path.join(slice, `${stage}.md`), body);
  render(slice);
  const board = path.join(slice, '.review-board/index.html');
  if (!fs.existsSync(board)) throw new Error('看板未生成，不能请求批准');
  return { ask: true, board, source: path.join(slice, `${stage}.md`) };
}

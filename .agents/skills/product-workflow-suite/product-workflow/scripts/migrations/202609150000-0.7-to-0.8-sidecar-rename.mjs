// ADR-0006 版本链第 4 步（本地半边）：旧 `.product-workflow-portal.json`
// 改名 `.limix-artifacts.json`。无绑定切片只记录不造册；门户旧 REQ-* 的对账
// 由 `0.8-portal-req-reconcile` 停下来问人。两侧 sidecar 并存属冲突，直接抛错不覆盖。
import fs from 'node:fs/promises';
import path from 'node:path';

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function migrateLegacySidecars(slices) {
  const renamed = [];
  const unbound = [];
  const conflicts = [];
  for (const slice of slices) {
    const legacy = path.join(slice, '.product-workflow-portal.json');
    const current = path.join(slice, '.limix-artifacts.json');
    if (await exists(legacy) && await exists(current)) {
      conflicts.push({ slice, legacy, current });
      continue;
    }
    if (await exists(legacy)) {
      await fs.rename(legacy, current);
      renamed.push({ slice, from: legacy, to: current });
    } else if (!(await exists(current))) {
      unbound.push(slice);
    }
  }
  if (conflicts.length) {
    throw new Error(`发现新旧规格索引同时存在，未覆盖任何文件：${conflicts.map((item) => item.slice).join(', ')}`);
  }
  return {
    action: renamed.length ? 'renamed' : 'reported',
    renamed,
    unbound,
    note: unbound.length
      ? '没有本地绑定文件的切片只做记录；门户旧 REQ-* 需要人工对账，不自动新建规格。'
      : undefined,
  };
}

export default {
  id: '0.7-to-0.8-sidecar',
  target: 'v0.8.0',
  apply: async (_root, context) => migrateLegacySidecars(context.slices),
};

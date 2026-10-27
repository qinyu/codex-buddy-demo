// ADR-0006 决策 5：门户上是 REQ-*、本地没有绑定文件的切片不算已绑定。
// 本步骤按标题列出这些切片并停下来问人，三选一：
//   绑到已有规格（limix spec bind）/ 新建规格（用户确认后 spec create）/
//   保持普通需求不传产物。
// 禁止静默 spec create 造第 8 条。人裁决并绑定后重跑本迁移即通过；
// 未裁决前迁移停在一步，账本不落盘。
import fs from 'node:fs/promises';
import path from 'node:path';

const BINDING_FILES = ['.limix-artifacts.json', '.product-workflow-portal.json'];

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function sliceTitle(slice, fallback) {
  try {
    const text = await fs.readFile(path.join(slice, 'prd.md'), 'utf8');
    const match = text.match(/^#\s+(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // 没有 prd.md 时退回目录名。
  }
  return fallback;
}

export default {
  id: '0.8-portal-req-reconcile',
  target: 'v0.9.0',
  apply: async (_root, context) => {
    const candidates = [];
    for (const slice of context.slices) {
      const bound = await Promise.all(BINDING_FILES.map((file) => exists(path.join(slice, file))));
      if (!bound.some(Boolean)) {
        candidates.push({ slice, title: await sliceTitle(slice, path.basename(slice)) });
      }
    }
    if (!candidates.length) {
      return { action: 'bound', slices: context.slices.length };
    }
    return {
      action: 'needs-human',
      candidates,
      question: '以下切片在门户可能是 REQ-* 普通需求、本地没有规格绑定。每条请人决定：绑已有规格 / 新建规格 / 保持普通需求不传产物；裁决前迁移不记账。',
    };
  },
};

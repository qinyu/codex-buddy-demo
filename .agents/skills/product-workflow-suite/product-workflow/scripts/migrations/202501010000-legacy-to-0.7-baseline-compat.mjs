// ADR-0006 版本链第 1–3 步（≤0.7）的基线：state 字段、原型回链、看板路径
// 始终由 migrate_suite 的形状迁移幂等执行；本步骤只为账本提供 ≤0.7 的起点记录。
export default {
  id: 'baseline-to-0.7',
  target: 'v0.7.0',
  apply: async (_root, context) => ({
    action: 'compatibility-pass',
    slices: context.sliceResults.length,
  }),
};

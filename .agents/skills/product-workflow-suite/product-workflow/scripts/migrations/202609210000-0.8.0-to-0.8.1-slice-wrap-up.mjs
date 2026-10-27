// ADR-0006 版本链第 5 步：0.8.1 起 slice_wrap_up 可缺省，历史 state 无需改写。
// 本步骤不改文件，只为 0.8.0→0.8.1 在账本上留下有界、可重跑的记录。
export default {
  id: '0.8.0-to-0.8.1-slice-wrap-up',
  target: 'v0.8.1',
  apply: async (_root, context) => ({
    action: 'compatibility-pass',
    slices: context.sliceResults.length,
  }),
};

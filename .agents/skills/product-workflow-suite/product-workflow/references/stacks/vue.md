# Vue UI 切片

识别：`package.json` 含 `vue`，或存在 `.vue` 文件。先读实际 Vue 版本、路由、状态库、UI 组件库、token/CSS 和相邻页面；不得把 Vue 2 写法迁成 Vue 3，也不得绕开现有组件库。

- 原型：以现有页面结构、组件和 `DESIGN.md` 为视觉事实；写清入口、响应式断点、loading/empty/error/permission/success 状态。
- 实现：复用 composable/store/request 封装；单文件组件沿用现有 Options/Composition API 与 JS/TS；不为小改引入新状态库或 CSS 体系。
- 测试：沿用 Vitest/Jest + Vue Test Utils（若已有）；测用户可见行为、事件、props 与状态，不断言框架内部。E2E 沿用现有工具。
- 验证：从 `package.json` 取原命令，记录 typecheck、unit、lint/build 中实际执行项。单测通用规则见 `unit-test-generator/references/frontend/typescript.md` 或 `javascript.md`。

# JavaScript / TypeScript / H5

检测信号：`package.json`、`tsconfig.json`、`eslint.config.*`、`.prettierrc*`、`vitest.config.*`、`playwright.config.*`。

常见命令：
- lint: `npm run lint`, `pnpm lint`, `bun run lint`
- typecheck: `npm run typecheck`, `pnpm typecheck`, `bun run typecheck`
- test: `npm test`, `pnpm test`, `bun test`, `bun run test:unit`

建议：
- staged lint/format 放入 `pre-commit`。
- 单元测试或 E2E 放入 `pre-push` 候选。
- `lint-staged` 适合作为 staged files 过滤层，但不是 hook manager。

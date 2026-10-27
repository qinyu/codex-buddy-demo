# simple-git-hooks

simple-git-hooks 适合已有 JS/TS 项目中的轻量 hook 管理。MVP 只在发现 `package.json` 中已有 `simple-git-hooks` 时保守补齐。

典型检查：
- `scripts.prepare` 是否为 `simple-git-hooks`
- `simple-git-hooks.pre-commit` 是否存在
- `simple-git-hooks.commit-msg` 是否存在
- `lint-staged` 是否非空

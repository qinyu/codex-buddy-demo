# Lefthook

Lefthook 是 Go 编译的单二进制。npm、brew、winget、apt、pip、gem 和 release binary 都只是分发渠道。多技术栈新项目默认推荐 Lefthook，因为它能用 `root`、`glob`、`files`、`parallel` 和 `scripts` 调度项目已有命令。

## MVP 配置模式

```yaml
pre-commit:
  parallel: true
  commands:
    frontend-lint:
      root: "frontend/"
      glob: "*.{js,jsx,ts,tsx,vue}"
      run: pnpm eslint {staged_files}
commit-msg:
  commands:
    commitlint:
      run: npx --no -- commitlint --edit {1}
```

耗时检查放入 `pre-push` 候选，并要求用户确认。

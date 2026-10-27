# Husky

Husky 适合已有 JS/TS 项目。MVP 在发现 Husky v4 或 v7+ 时保守补齐，不迁移到 Lefthook，也不把 Husky 推荐为新多技术栈默认方案。

## 诊断版本

| 形态 | 识别方式 | 补齐方式 |
|---|---|---|
| Husky v4 | `package.json` 中存在 `husky.hooks` | 在 `husky.hooks` 下追加缺失 stage，不改写已有命令 |
| Husky v7+ | 存在 `.husky/` 目录 | 在对应 `.husky/<stage>` 文件中追加命令，保留 shebang 和已有内容 |
| 自定义 hooksPath | `.git/config` 中存在 `core.hooksPath` | 只读取目标目录并输出 patch 建议；不要直接编辑 `.git/config` |

## 保守补齐规则

- 修复时保留已有 `.husky/*` 或 `package.json.husky.hooks` 内容，只输出追加命令的 patch。
- 如果已有 `pre-commit` 只做 lint/format，不要把全量测试硬塞进去；测试通过率和覆盖率阈值默认放在 `pre-push`。
- 如果 `pre-push` 缺失，但项目已有 `test:coverage`、`test:ci`、`mvn test`、`gradle test` 等团队确认命令，追加到同一 Husky 形态中。
- 如果测试命令或报告路径不存在，停止并转入 `unit-test-init`，不要在本 Skill 中初始化测试框架。

## Husky v4 示例

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:coverage"
    }
  }
}
```

## Husky v7+ 示例

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run test:coverage
```

如果 `.husky/pre-push` 已存在，把新命令追加到文件末尾；如果不存在，新建文件并提醒用户确认 Husky 安装状态。

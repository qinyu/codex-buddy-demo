# Git Hook Manager Selection

| 情况 | 推荐 |
|---|---|
| 已有 Lefthook | 保守补齐 Lefthook |
| 新多技术栈项目 | 默认推荐 Lefthook |
| 已有 pre-commit | 保守补齐 pre-commit |
| Python/pre-commit 生态成熟 | 可推荐 pre-commit |
| JS/TS 已有 Husky v4 / Husky v7+ / simple-git-hooks | 保守补齐现有工具 |
| 用户要求最少依赖 | Lefthook binary 或极薄脚本 handler |

## 决策原则

Lefthook 是多技术栈新项目默认方案，因为它是单二进制调度层，可以直接调用各技术栈已有命令。pre-commit 生态更丰富，但默认引入 Python 依赖。Husky v4（`package.json.husky.hooks`）、Husky v7+（`.husky/`）和 simple-git-hooks 更适合已有 JS/TS 项目的保守补齐。自写脚本只作为 handler，不作为主 hook manager；如果仓库使用 `core.hooksPath` 指向 `.githooks/` 等自定义目录，只诊断并保守补齐该目录，不改写 `.git/config`。

涉及单元测试和覆盖率时，hook manager 只负责调度项目已有命令。不要因为要接入覆盖率阈值就强制引入统一增量覆盖率工具；团队已经确认的 `test:coverage`、`jacoco:check`、`koverVerify` 或等价脚本都可以作为 `pre-push` 命令。

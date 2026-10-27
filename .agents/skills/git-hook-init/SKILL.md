---
version: 0.9.3
name: git-hook-init
metadata:
  version: "0.8.1"
  suite-id: "git-hook"
description: "Use when the user names git-hook-init, or the development plan lists a Git hook gate task. Diagnoses existing hooks and adds lint/test commands conservatively. Does not write unit tests."
compatibility:
  required_tools: ["bash", "node", "read", "write", "edit"]
---

# Git Hook 质量门禁初始化 (git-hook-init)

## 和外挂 / 工作流怎么互找

本 skill 是独立分包 `git-hook`。工作流用 `$git-hook-init` 触发，不要按同仓相对路径去找。负责诊断、补齐和修复仓库级 Git Hook 配置。

当门禁涉及单元测试或覆盖率时，本 Skill 只负责把项目已经验证过的测试命令、覆盖率阈值命令和报告路径接入 Git 生命周期。测试基建和测试代码仍由对应 unit-test Skill 负责。

本 Skill 不负责编写单元测试，也不负责初始化测试框架：

- 缺少测试环境、JUnit XML 或 coverage XML 时，转入 `unit-test-init`。
- 需要编写、补齐、修复或审查单元测试时，转入 `unit-test-generator`。
- 测试失败或覆盖率不足时，Git Hook 只拦截并报告缺口，补测试转入 `unit-test-generator`。

## 定位和默认策略

- 已有 hook manager 时，沿用当前工具，只做诊断和保守补齐。
- 新多技术栈项目默认推荐 Lefthook 作为 Git Hook 调度层。
- 已有 `.pre-commit-config.yaml` 或成熟 Python/pre-commit 生态时，保守补齐 pre-commit。
- Husky 和 simple-git-hooks 仅作为已有 JS/TS 项目的保守补齐目标，不作为新多技术栈默认方案。
- 自写脚本只作为 Lefthook 或 pre-commit 的 handler，不作为主 hook manager。

## 步骤 1：只读诊断

先运行只读诊断，不要直接改文件。读取：

- `package.json`
- `lefthook.yml` / `.lefthook.yml`
- `.pre-commit-config.yaml`
- `.husky/`
- `package.json` 中的 `husky.hooks`（Husky v4）
- `simple-git-hooks`
- `.git/config` 中的 `core.hooksPath`（只读取路径，不直接编辑 `.git/`）
- `.git/hooks`
- 常见自定义 hook 目录：`.githooks/`
- Java/Android: `pom.xml`, `build.gradle`, `build.gradle.kts`, `settings.gradle*`, `gradlew`, `mvnw`
- JS/H5: `package.json`, `tsconfig.json`, `eslint.config.*`, `.prettierrc*`, `vitest.config.*`, `playwright.config.*`
- iOS: `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, `Podfile`, `.swiftlint.yml`, `.swiftformat`
- Go: `go.mod`, `go.work`, `Makefile`, `Taskfile.yml`

必须输出：

1. 当前 hook manager
2. 已有 hook stages
3. 已有质量命令
4. 技术栈和子项目边界
5. 缺口和风险
6. 推荐动作
7. 是否需要 `unit-test-init`
8. 测试通过率与覆盖率阈值门禁：本地命令、报告路径、阈值来源、是否适合 `pre-push`
9. 验证命令

## 步骤 2：选择工具策略

读取 `references/manager-selection.md`。

选择规则：

1. 已有 hook manager 且健康：沿用，不迁移。
2. 已有 hook manager 但缺配置：保守补齐同一工具。
3. 新多技术栈项目：默认推荐 Lefthook。
4. 已有 `.pre-commit-config.yaml` 或 Python/pre-commit 生态：保守补齐 pre-commit。
5. JS/TS 项目已有 Husky v4（`package.json.husky.hooks`）、Husky v7+（`.husky/`）或 simple-git-hooks：保守补齐现有工具。
6. 用户明确要求最少依赖：优先 Lefthook binary 或极薄脚本 handler，不推荐 pre-commit。

## 步骤 3：按工具和技术栈读取 references

按诊断结果只读取相关参考文件：

- Lefthook: `references/tools/lefthook.md`
- pre-commit: `references/tools/pre-commit.md`
- Husky: `references/tools/husky.md`
- simple-git-hooks: `references/tools/simple-git-hooks.md`
- Java: `references/stacks/java.md`
- JS/H5: `references/stacks/javascript-h5.md`
- Go: `references/stacks/go.md`
- Android: `references/stacks/android.md`
- iOS: `references/stacks/ios.md`
- 通用安全和 commit message: `references/stacks/shared.md`
- 单元测试通过率和覆盖率阈值门禁: `references/unit-test-quality-gates.md`

不要一次性加载所有 references。

## 步骤 4：保守补齐或修复

写入前必须列出将修改的文件、原因和验证命令。默认先输出 patch 或计划；只有用户明确要求落地时才写入文件。

修复范围：

- hook manager 配置存在但 hook 未安装。
- 配置引用的命令不存在。
- `lint-staged` 配置为空。
- `commit-msg` 存在但缺 commitlint 或等价规则。
- `pre-commit` 中放入了明显过重的全量测试。
- 多技术栈项目根目录误判，导致只检查了一个子项目。
- 单元测试或覆盖率阈值命令已存在但未接入 `pre-push`。
- 团队已经确认阈值和报告路径，但 hook 配置没有复用同一条本地检查命令。

## 硬规则

- 沿用已有 hook 配置和 hook manager。
- `pre-commit` 只放轻量检查；`pre-push` 接入变更范围测试、known-failures 基线和 changed-line 覆盖率。
- lock file 只在包管理器或用户明确要求时更新。
- `.git/` 只读取 `core.hooksPath`。
- secret 文件只记录路径和元信息。
- 验证只用轻量命令。
- 没有命令证据的项目标为候选。
- 增量覆盖率复用 `references/unit-test-quality-gates.md` 指向的现成命令。
- 未确认的覆盖率阈值标为待确认。

## 与产品工作流的关系

- `$product:technical-solution` 发现 Git Hook 质量门禁现状和缺口。
- `$product:plan` 把缺口转成 `TASK-000` 或第一个开工前置任务。
- `$product:kickoff` 在门禁未完成时建议先做；用户要先写业务则记豁免后继续。
- `$product:develop` 在新增质量命令后提醒同步 hook 配置，但不临场迁移工具。

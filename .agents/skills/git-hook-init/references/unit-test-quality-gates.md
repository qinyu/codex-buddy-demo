# Unit Test Quality Gates

本 reference 用于把 `unit-test-init` 和 `unit-test-generator` 的结果接入 Git Hook。

## 职责边界

- `unit-test-init` 负责测试基建、测试命令、JUnit XML 和 `reports/coverage.xml` 能力。
- `unit-test-generator` 负责补齐、修复、审查单元测试，以及处理不可测代码和覆盖率豁免建议。
- `git-hook-init` 只负责把已验证的本地检查命令接入 hook，默认作为 `pre-push` 候选。

如果缺少测试命令、JUnit XML 或 coverage XML，停止 hook 生成并标记需要 `unit-test-init`。
如果测试失败或覆盖率不足，输出失败原因并引导回 `unit-test-generator`，不要在本 Skill 内生成测试。

## 推荐门禁模型

优先复用项目已经存在并能手动运行的命令：

| 门禁 | 推荐 stage | 证据 | 失败后路由 |
|---|---|---|---|
| 变更范围内单元测试通过（增量，见下节） | `pre-push` | 只跑变更模块/关联测试，非零退出即失败；JUnit XML 可选收集 | 修测试或业务逻辑；需要补测试时触发 `unit-test-generator` |
| 覆盖率达标（优先 changed-line 口径，见下节） | `pre-push` | 框架或构建工具返回非零退出码；`reports/coverage.xml` 可选收集 | 补当前目标测试、调整合理阈值或记录豁免 |
| 报告产物存在 | `pre-push` 或显式本地命令 | `junit.xml` / `TEST-*.xml` 和 `reports/coverage.xml` 存在且非空 | 触发 `unit-test-init` 修基建 |

不要默认把单元测试或覆盖率检查放进 `pre-commit`。这些命令通常较慢，适合 `pre-push` 或用户显式执行的本地检查命令。

## 增量执行（默认路径，替代全量）

存量测试红、存量覆盖率低的仓库里，`pre-push` 全量 + 100% 通过率会永远拦住 push，门禁形同虚设。默认按**增量**接入：

- 测试范围：只跑本次变更模块或关联测试。按栈选命令（均为示例，同类构建工具同一原则）：Maven 用 `-pl <module>` + `-Dtest=...`；Gradle 用 `:module:test` + `--tests`；Jest/Vitest 直接传变更文件路径或用 `--findRelatedTests` / `--changed`；pytest 传变更文件或用 `--lf`。
- 通过率基线：接入时先记录当前存量失败清单（known-failures 基线，落盘到仓库内如 `docs/quality/known-failures.txt` 并注明日期）；门禁只卡「本次改动相关测试 + 存量失败不得新增」。存量失败由团队按计划清偿，基线只减不增。
- 覆盖率口径：优先用 changed-line coverage（只对本次改动行计覆盖率）替代全量阈值；框架原生不支持时，退而求本次变更模块的模块级阈值（`-pl` 范围内的 jacoco check / per-file coverage），不得回退到全仓全量阈值。
- 输出时必须写明本次接入用的是增量还是全量、范围如何计算、基线文件在哪；写不清楚就不算接完。

来源：0.3.0 核查结论⑤「pre-push 全量 + 100% 通过率」是最大缺口（遗留系统存量红测试永远挡 push）。

## 阈值来源

覆盖率阈值应来自团队确认的项目配置或命令，而不是由本 Skill 随机生成：

- Python: `pytest.ini`、`pyproject.toml`、命令行 `--cov-fail-under`
- JavaScript / TypeScript: `jest.config.*`、`vitest.config.*`、`package.json` script
- Java Maven: `pom.xml` 中 JaCoCo `check` / `rule`
- Java / Kotlin Gradle: `build.gradle(.kts)` 中 JaCoCo / Kover verification task
- Go: `go test` 命令、`Makefile`/`Taskfile` 中的 coverage target、`gocover-cobertura` 转换脚本
- Flutter: `flutter test --coverage` 后接团队脚本或 LCOV 检查
- iOS / Swift: Xcode coverage、Slather 配置或团队脚本

如果项目没有阈值，输出候选配置位置和待确认问题，不要直接写死一个统一阈值。

## 增量覆盖率的处理

统一增量覆盖率**算法**（自研 diff-cover 工具）不是 MVP 默认路径，不发明：本 Skill 不生成 `incremental_coverage.py`、不设计统一 diff-cover 规则、不把所有团队强制迁到同一套增量覆盖率算法。

但增量**执行与口径**是默认路径（见上节）：测试只跑变更范围，通过率用 known-failures 基线，覆盖率优先 changed-line 口径或模块级阈值。项目已有现成增量覆盖率工具时直接复用，接入为普通本地检查命令。

## Hook 接入建议

输出时明确列出：

- 本地检查命令
- 执行目录
- 适合的 hook stage
- JUnit 报告路径
- Coverage 报告路径
- 阈值来源
- 用户需要手动确认的耗时和依赖

示例映射：

```text
pre-push:
  frontend: npm run test:coverage
  backend: ./gradlew test koverVerify
  go-service: make coverage
```

前端项目要区分快速本地红绿命令和完整门禁命令：`npm run test:unit:quick -- <path>` 适合开发循环；`npm run test:coverage` 才适合 `pre-push` 或 CI gate，因为它应同时断言测试通过、阈值达标和 `reports/coverage.xml` 产物存在。

如果仓库已有 hook manager，按当前工具的配置格式保守追加。没有 hook manager 且是多技术栈项目时，才推荐 Lefthook。

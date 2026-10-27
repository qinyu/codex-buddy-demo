---
name: product-technical-solution
description: Use when the user explicitly names product:technical-solution to generate or revise the product workflow technical solution
---

# 产品技术方案

## 命令

```text
$product:technical-solution
```

## 前置条件

先套 `../product-workflow/references/run-mode.md` 完整档可裁剪：无新模块、无新接口、无权限或数据边界变化 → 在 state 标 `Not Applicable` 并写原因（已有方案则引用路径），不重写 `technical-solution.md`，本 skill 完成。用户点名或有新模块/接口/权限数据边界 → 继续下面步骤。

使用 Project Wiki、PRD、原型、测试用例和自动化测试计划上下文。提出架构或文件范围前，必须先检查代码库。代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`。

跨前后端共享接口的合同与变更影响按公共契约 § 共享合同事实源与变更影响：复用既有事实源，变更前列出调用方、兼容性与验证范围，缺事实列待确认，不另造第二份合同。

## 项目初始化配置门禁

## 项目初始化配置门禁

写本阶段产物前，读配置、继承 `workflow_policy`（Project Wiki、Repo Wiki、代码探查、原型路线、自动化测试、单元测试基建检查、门户同步）、stale-config continuation、`explicit_override`、`code_exploration` 为 `user_declined` 等通用规则，全部见公共契约 § Project Init Config Gate。本阶段无额外独有配置项。

## 输入

读取 `project-wiki.md`（如存在）、`prd.md`、`prototype.html`、`stitch-prototype.md`、`test-cases.md`、`automation-test-plan.md`、`.workflow-state.json` 和相关代码/文档。如果无法访问目标代码库，必须明确说明，并把文件/模块范围标为假设。

技术方案必须区分 `stitch-prototype.md` 中已批准的 Stitch 事实和评审缺口，不得把缺口当作架构、接口、数据或发布决策依据。

## Repo Wiki 技术方案门禁

已有Wiki时按公共 Wiki Context Gate 读取相关导航与主题，页面存在且与任务有关才加载；缺页不强制生成。具体实现事实按源码探查许可回查，记录来源、冲突和未覆盖范围，不把Wiki当最终证据。

代码事实按公共契约 §3a：`query_ready=true` 时，旧实现指针与影响面优先 `query --kind cite` / `--kind impact`（见 `code-wiki-context.md`）；不可查询时按探查许可走 wiki + 源码回查。

`technical-solution.md` 必须说明 repo wiki 如何影响模块 ownership、接口族群、数据流、权限边界、发布/回滚风险和 ask-first 风险。除非 `workflow_policy.code_exploration` 为 `user_declined`，具体 schema、endpoint、权限判断、状态机、运行命令和配置值仍必须回查源码、测试或配置；如果 wiki 与源码冲突，以源码为准，并在技术依据中写明冲突和采用的源码路径。

## AI 不确定性澄清门禁

写 `technical-solution.md` 前，先列出 AI 无法从 Project Wiki、PRD、原型、测试用例、自动化测试计划和代码探索中可靠确认的工程问题，并判断是否阻断技术方案。阻断性不确定项不得仅写为“假设”或“待确认问题”后继续产出完整技术方案。

技术方案开始前必须生成“不确定性清单”，逐项写明来源、影响模块、影响的 `AC/TC`、是否阻断架构/API/数据/发布决策、是否需要回到前序产物修正。当前技术方案阻断项必须先问清楚或回到前序产物修正；不得把会改变架构、数据模型、接口契约、权限边界或发布风险的问题留到开发计划再处理。

以下情况必须先问用户或回到前序产物修正，再写技术方案：

- PRD 验收标准、用户旅程、状态定义或范围边界不清楚，导致架构可能选错。
- 目标代码库、部署环境、数据存储、鉴权模型、权限边界或集成方无法确认。
- API 契约、数据模型、状态机、迁移、兼容性、回滚或观测需求需要靠 AI 猜测。
- 安全、隐私、合规、审计、数据保留或多租户边界存在未决决策。
- 代码探索发现与 PRD、测试用例或用户决策冲突。

技术方案特有的阻断是架构、数据/API、权限与发布决策；澄清顺序、Draft 与批准依公共契约。用户授权按假设继续时，方案必须把这些假设集中放在“阻断假设与后续确认”中，并标出哪些实现任务在确认前不得启动。

请求批准技术方案时必须附上仍未解决的不确定项清单；用户未确认接受前，不得把 Technical Solution 状态写成 `Reviewed`。

## 代码和系统上下文门禁

代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

写技术方案前必须探索当前项目真实代码、配置和文档，不得只根据 PRD 想象架构。除非用户明确要求“只做概念方案，不看代码”，否则必须确认项目根目录，读取 `project-wiki.md` 中的仓库/包地图、repo wiki 状态和生成/引用路径，搜索相关模块、路由/API、服务、数据库/迁移、权限、配置、测试、脚本和历史设计文档。

`technical-solution.md` 必须写入“当前系统上下文”章节，列出关键文件/目录、继承的 Project Wiki 事实、确认事实、受影响模块、可复用能力和仍是假设的内容。如果项目根目录不明确、代码证据不足、Project Wiki 与代码探索冲突、或发现与 PRD 冲突，先问一个澄清问题，不得直接写完整技术方案。

## 规则贯穿

规格已要求真实数据源时，方案保留该来源、关联、刷新和状态；前端模拟数据只作界面事实，不用硬编码或模拟数据替代实现。接口未核实时交给系统负责人，不编造函数、URL 或命令。用户明确不能读代码，或只要概念方案时，交付可用的概念方案并标明实现未核实；这不取消已有验收和权限依赖。

已有定向测试和 fixture 时，围绕本次规则选择定向验证。单元测试基建缺口和 Git Hook 质量门禁缺口仍按后两节记录，但是建议项；缺报告或 Hook 本身不触发安装、迁移或部署。已有验收和自动化计划直接引用，权限依赖和待核实位置单列，不重定业务范围。

## 单元测试基建门禁

写技术方案时必须检查目标实现范围对应的单元测试现状，不得把测试基建留到实现阶段才发现。检查至少包含：

- 已有测试框架、测试目录、测试命名模式和测试夹具。
- 可执行的单元测试命令、最小局部验证命令和期望输出。
- 是否能产出 `junit.xml` / `TEST-*.xml` 和 `reports/coverage.xml`，或项目约定的等价报告。
- 若当前项目缺少测试框架、测试命令或报告产物，必须在 `technical-solution.md` 写入“单元测试基建缺口”章节，并明确标记需要 `unit-test-init` 在开工前准备。

如果发现缺口，不要在技术方案阶段直接执行构建或测试初始化脚本；应把缺口、目标报告产物、候选技术栈、预计修改文件和验证方式写清楚，供开发计划生成前置任务。

## Git Hook 质量门禁

写技术方案时必须检查目标实现范围对应的 Git Hook 质量门禁现状，不得把提交前质量保障留到实现阶段才发现。检查至少包含：

- 当前 hook manager：Lefthook、pre-commit、Husky、simple-git-hooks、raw git hooks 或 none。
- 已有 hook stages：`pre-commit`、`commit-msg`、`pre-push` 或等价 CI gate。
- 质量命令覆盖：format、lint、typecheck、test、commit message、secret/large file。
- 多技术栈子项目覆盖情况：Java、JS/H5、Android、iOS 或其他相关模块。
- 是否存在命令过重、只覆盖单一子项目、hook 未安装或配置不可验证的问题。
- 若当前项目缺少提交前或推送前质量门禁，必须在 `technical-solution.md` 写入“Git Hook 质量门禁缺口”章节，并明确标记需要 `git-hook-init` 在开工前准备。

如果发现缺口，不要在技术方案阶段直接迁移 hook manager；应把当前工具、候选工具、需要修改的配置文件和验证方式写清楚，供开发计划生成前置任务。

## 输出

写入或修订 `technical-solution.md`，包含架构、涉及模块、数据/API 变化、依赖、迁移、发布、可观测性、安全、隐私、性能、可靠性、兼容性、备选方案和取舍。

技术方案必须包含：

- 阅读上下文：说明方案解决什么问题、谁来评审、依赖哪些 PRD/测试/代码库信息、哪些范围仍是假设
- Project Wiki 继承事实和代码/配置/文档探索证据
- repo wiki 技术依据：已读 wiki 页面、已回查源码/配置路径、wiki 对 ownership/接口/数据流/权限/发布风险的影响、wiki 缺口或过期风险
- 自动化测试依据：已读取 `automation-test-plan.md`，说明 `AUTO-TASK-xxx`、测试环境、测试数据、报告产物和 CI/local 命令如何影响架构、接口、观测、权限、数据准备和发布风险
- 架构概览和组件边界
- 可访问代码库时给出精确涉及模块/文件
- API/接口示例，包含字段、校验、鉴权、错误响应
- 数据模型、状态流转、迁移、兼容性、回滚
- 错误处理、可观测性、埋点、隐私、安全、性能、可靠性
- 单元测试基建现状：测试框架、测试命令、报告产物、缺口和是否需要 `unit-test-init`
- Git Hook 质量门禁现状：当前 hook manager、hook stages、质量命令覆盖、多技术栈覆盖、缺口和是否需要 `git-hook-init`
- 备选方案和取舍
- 如何满足 PRD 验收标准、测试用例风险和自动化测试计划中的 `AUTO-TASK-xxx`
- 架构、状态流转、权限边界、数据流、发布/回滚路径必须写进 `technical-solution.md` 的 mermaid 围栏或等价图示。看板只渲染这份源头。

写入 `technical-solution.md`，将状态设为 `Draft`，并请求明确批准。源头有更新就必须刷新看板 HTML：运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在。

请求批准前，自检空泛架构、缺失接口、缺失回滚、缺失到测试的追踪关系。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- Technical Solution：包含 ER 图、API 表、状态流转、权限、降级、发布和回滚。

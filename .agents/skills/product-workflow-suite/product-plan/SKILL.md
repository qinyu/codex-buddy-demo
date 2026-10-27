---
version: 0.9.3
name: product-plan
description: >-
  开发计划。用户点名 product:plan、product:development-plan，或要把已批 PRD / 技术方案拆成可执行任务时使用。
---

# 产品计划

## 命令

```text
$product:plan
$product:development-plan
```

## 前置条件

full 模式使用已批准的 Project Wiki、PRD、原型决策、测试用例、自动化测试计划和技术方案。如果任一必需产物缺失，先请求生成或评审；用户明确确认 Project Wiki 或自动化测试计划不适用时除外。

`lite` 只要求短 `prd.md` 为 `Reviewed`，以及被裁剪阶段在 state 中为带原因的 `Not Applicable`。

大需求允许 `CHECKPOINT`：做到一半先给人看方向，不重跑全流程。检查点写进计划任务，完成标准是用户看过并决定继续或停。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`。

共享合同变更的任务按公共契约 § 共享合同事实源与变更影响编排：变更前识别调用方、兼容性和验证范围，复用既有事实源，不另造第二份合同。

## 项目初始化配置门禁

写本阶段产物前，读配置、继承 `workflow_policy`（Project Wiki、Repo Wiki、代码探查、原型路线、自动化测试、单元测试基建检查、门户同步）、stale-config continuation、`explicit_override`、`code_exploration` 为 `user_declined` 等通用规则，全部见公共契约 § Project Init Config Gate。本阶段无额外独有配置项。

## 输入

读取全部前序产物、`project-wiki.md`（如存在）、`automation-test-plan.md`（如适用）和审批状态。如果任一必需产物未批准或未明确确认不适用，先请求评审，不要写可直接执行的实现计划。

## Repo Wiki 开发计划门禁

已有Wiki时按公共 Wiki Context Gate 读取相关导航与主题，页面存在且与任务有关才加载；缺页不强制生成。具体实现事实按源码探查许可回查，记录来源、冲突和未覆盖范围，不把Wiki当最终证据。

开发计划的任务顺序、文件 ownership、验证命令、禁止并行边界、回滚步骤和风险检查点必须继承适用的 repo wiki 门禁。wiki 只能作为导航和风险提示；如果 wiki 缺少命令、模块事实、owner 边界或配置依据，`development-plan.md` 必须列出需要回查的源码、测试或配置文件，不得把 wiki 写成权威来源。

## AI 不确定性澄清门禁

写 `development-plan.md` 前，先列出 AI 无法从 Project Wiki、PRD、原型、测试用例、技术方案、审批状态和代码探索中可靠确认的执行问题，并判断是否阻断开发计划。阻断性不确定项不得仅写为“假设”或“待确认问题”后继续产出可执行计划。

以下情况必须先问用户、回到前序产物修正，或明确获得按假设继续授权：

- 前序产物审批状态不明确，或仍有会改变任务范围、验收、架构/API、数据模型、权限边界的未决问题。
- 实现文件范围、模块 ownership、任务依赖、验证命令、测试先行路径或回滚策略无法确认。
- 任务是否适合 multi-subagent 顺序执行、ownership 如何划分、哪些任务有强先后关系或禁止并行实现需要靠 AI 猜测。
- 代码探索发现与技术方案、测试用例或用户批准内容冲突。
- 环境、构建、迁移、发布、数据回填、feature flag 或灰度策略不清楚，并会影响执行顺序或风险。

开发计划特有的阻断是任务文件范围、验证命令和前序产物冲突；澄清顺序、Draft 与批准依公共契约。用户授权按假设继续时，`development-plan.md` 必须集中列出这些假设、受影响 `TASK/TC`、以及哪些任务在确认前不得开工。

请求批准开发计划时必须附上仍未解决的不确定项清单；用户未确认接受前，不得把 Development Plan 状态写成 `Reviewed`，也不得进入 `$product:kickoff`。

## 实现上下文门禁

代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

写开发计划前必须探索当前代码库的真实实现位置、测试命令和构建命令，不得只根据技术方案编任务。除非用户明确要求“只写概念计划”，否则必须读取 Project Wiki 的仓库/包地图、repo wiki 状态和生成/引用路径，搜索技术方案涉及的文件、模块、路由/API、测试、脚本和配置。

`development-plan.md` 必须写入“实现上下文”章节，列出关键文件/目录、候选文件范围、仓库 ownership、验证命令来源、未知项和风险检查点。如果文件范围、仓库 ownership 或验证命令无法确认，先问用户或回到 `$wiki`/`$product:technical-solution`，不得写占位式可执行计划。

## 规则贯穿

每个相关任务引用同一规则、数据来源、关联、验收和有效编号，并安排必要的整体检查。未核实的工程入口标待核验，不写成可执行命令，也不交给 PM 填写。依赖范围写明责任角色和恢复条件；可独立进行的任务继续，不把全部任务停到外部答复，也不把计划说成已分派或已发送。

无新增门禁的小改动仍走现行门禁：对抗审查、必需记录和未受影响的有效批准保留，不因无新增门禁而跳过。小任务不因此扩成整套规格、自动化方案或固定数量任务。

## 单元测试准备（建议，不挡编码）

写开发计划时读取技术方案中的单元测试基建现状。若缺少可跑的测试命令或报告，计划里按顺序加两条任务：先 `unit-test-init` 准备环境（可标 TASK-000，写清栈、脚本、用户怎么跑），再 `unit-test-generator` 编写测试。业务编码可以继续。任一任务未完成或没有本轮测试证据时，单元测试结果保持未完成。

## Git Hook 准备（建议，不挡编码）

若技术方案提到 Git Hook，计划里**建议**加 `git-hook-init` 诊断/保守补齐和验证命令。同样不挡开工。用户要先写业务时记下后继续。

## 自动化测试任务门禁

写开发计划时必须读取 `automation-test-plan.md`，除非该阶段已经明确标记为 `Not Applicable`。如果自动化测试计划包含 `AUTO-TASK-xxx`，开发计划必须把这些任务纳入实现顺序、文件范围、验证命令和期望证据。

每个 `AUTO-TASK` 必须转成可执行开发任务或明确标记为外部阻断项。可执行任务必须包含：

- 目标 repo/package 和测试文件路径。
- 依赖的 `TC-xxx`、自动化层级和目标命令。
- 测试数据、fixture、mock、seed 或账号要求。
- 本地验证命令、CI/report artifact 和通过标准。
- 与功能实现任务的顺序关系和回滚/降级策略。

如果 `automation-test-plan.md` 缺失、未批准或存在阻断的 P0 自动化任务，先回到 `$product:test-automation` 或请求用户决策；不得把 `AUTO-TASK` 写成“后续补充”。

## lite 短开发计划

`run_mode=lite` 时，不要求 Project Wiki、原型、测试用例、自动化测试计划、技术方案或 `AUTO-TASK`；不生成这些文件。`development-plan.md` 只写：

- 一个或少量 `TASK-xxx`，逐条关联短 PRD 的 `AC-xxx`。
- 允许修改的文件/模块与禁止扩大范围。
- RED / GREEN 或用户批准的替代验证。
- `## 验证命令`：执行位置、原文命令、通过标准。
- 风险与回滚。

计划是已批 PRD 的执行拆解，状态保持 `Draft`，写完不单独请求批准，可直接进入实现。阻断项仍要停下来问，不能因 lite 省略事实确认。

## 输出

full 模式写入或修订 `development-plan.md`，包含有序实现任务、测试先行检查点、文件范围、验证命令、评审点、回滚说明、依赖、顺序约束、ownership 边界和禁止并行实现说明。

开发计划必须包含：

- 阅读上下文：说明计划如何从技术方案和测试用例推导、谁来评审、开发前有哪些门禁
- 每个业务 `TASK` 必须同时列出：目标文件/模块范围、仓库 ownership、关联 `AC-xxx`/`TC-xxx`、RED 测试入口与预期失败、GREEN 验证命令与通过证据；缺任一项时，该任务只能列为阻断项，不能作为可执行任务
- 任务总表必须能逐行回答“谁负责、改哪里、先测什么、怎么验证、依赖谁、失败如何回滚”；不得用一个仓级命令列表代替任务级验证
- 实现上下文、文件范围和验证命令来源
- repo wiki 执行依据：已读 wiki 页面、继承的验证/测试/边界门禁、已回查源码/配置路径、wiki 缺口或过期风险
- 文件/模块职责图
- 单元测试：缺少可跑测试时，先准备环境，再编写测试。业务编码可以继续。
- Git Hook 准备：若技术方案提到 hook，建议写入 `git-hook-init`，不挡业务编码
- 自动化测试任务：继承 `automation-test-plan.md` 中的 `AUTO-TASK-xxx`，写清目标测试文件、验证命令、报告证据、依赖和阻断规则
- 足够小、可独立实现和评审的有序任务
- TDD 检查点：失败测试、预期失败、实现、通过测试
- 精确验证命令和期望证据
- 依赖、顺序约束、ownership 边界、禁止并行实现说明和推荐执行方式
- 评审检查点、发布步骤、回滚步骤、剩余风险
- 任务到技术方案章节、测试用例和自动化测试计划的追踪关系
- 任务顺序、依赖关系、ownership 边界、禁止并行实现说明、评审门禁必须写进 `development-plan.md` 的 mermaid 围栏或等价图示。看板只渲染这份源头。

## 验证命令可读性契约

验证命令是 Development Plan 的评审核心，不得在人类评审视图中只放一整个深色 `pre` 代码块。人类评审视图必须把验证命令拆成可扫描组件，至少展示：

- 执行目的：例如 CLI 单测、CLI typecheck、后端 route 测试、既有回归、看板校验。
- 执行位置：repo root、`packages/gateway-core` 或其他具体目录。
- 命令：使用可换行的浅色命令行组件或表格单元，长命令必须允许 `overflow-wrap:anywhere` 或等价换行。
- 期望证据：通过条件、关键输出或失败时应阻断的门禁。
- 关键命令必须原文保留，不得只改写成中文说明；优化的是呈现方式和上下文，不是删掉命令。

源头文件要求：

- 验证命令写在 `development-plan.md`：每条命令带执行目的、执行位置、原文命令和期望证据，紧挨对应任务或 TC。
- 人类评审看看板投影这份 Markdown；不要为排版去手写看板 HTML/CSS。
- 代码块保留完整 fenced bash，便于复制和后续 agent 执行。

写入 `development-plan.md`，将状态设为 `Draft`。接着跑 `$product:review`。本会话没有该 skill 时，读 `../product-review/references/checklist.md` 按清单自查，结论仍写进 `## 对抗审查`。full 在开发前请人批准；lite 计划不单独请批，过不了不得进入实现。源头有更新就必须刷新看板 HTML：运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在。`portal_sync=bound_project` 时只调用 `portalHandoff`，记下未同步，不因写成 Draft 自动上传。

不得使用未决占位词、空泛验证词、笼统边界处理表达或没有对象与命令的测试描述。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- Development Plan：每个 `TASK` 有文件范围、验证命令、依赖和回滚说明。
- 已跑 `$product:review`；源头有 `## 对抗审查`；有阻断发现时未请人批准、未进入实现。

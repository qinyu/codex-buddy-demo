---
name: product-test-automation
description: Use when the user explicitly names product:test-automation, or when the product workflow needs an automation strategy above unit tests for E2E, API, contract, integration, visual, accessibility, smoke, or regression coverage
---

# 产品自动化测试计划

## 命令

```text
$product:test-automation
```

## 定位

本 skill 是产品工作流中位于 `test-cases.md` 之后、`technical-solution.md` 之前的条件阶段。它负责把已经评审的 `AC -> TC` 测试用例转成单元测试以上的自动化测试策略和可执行任务计划。

本 skill 默认只生成或修订 `automation-test-plan.md`，不直接修改业务代码、不创建测试文件、不执行测试命令。需要真正生成测试代码时，必须由 `$product:develop` 在批准后的实现阶段执行。

单元测试基建和单测生成继续由 `unit-test-init` 与 `unit-test-generator` 负责。本 skill 只能引用它们，不得复制它们的技术栈规约。

## 前置条件

使用当前产品工作流目录。必须已存在 `test-cases.md`，且其中包含可追踪的 `AC -> TC` 映射。如果缺少映射，先回到 `$product:test-cases` 修正。

先套 `../product-workflow/references/run-mode.md` 完整档可裁剪：无新自动化范围（与用例同一把尺子）→ 在 state 标 `Not Applicable` 并写原因，不生成 `automation-test-plan.md`，本 skill 完成。有新的 UI/API/数据/权限自动化范围，或 `workflow_policy.test_automation=required` 且用户未覆盖 → 继续下面步骤。

## 语义验证

环境缺失只阻断执行，计划仍可完成。执行标明前提：计划写明隔离账号、环境前提、责任角色和预期证据；不编造账号，不编造已运行的命令，也不把整份计划判为不能完成。

已批准的 AC 与 TC 覆盖完整、正式批准有效，只缺编号或正式追踪时，补上该正式追踪后继续，不因为映射形式缺失退回上游。缺用例或覆盖不全则回到 `$product:test-cases`。按风险选择验证层次，不强制覆盖所有层，也不因此新增 CI。

文档-only 且没有新的可观察行为时，说明无需工程自动化，按文档检查内容一致性，并标 `Not Applicable`。不造工程占位，不为阶段占位创建空计划或空看板。`workflow_policy.test_automation=required` 时，required 工程验证不能凭文档-only 豁免；未执行保持不完整，真实失败与重跑单列。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`，尤其是 `Wiki Context Gate`。

## 项目初始化配置门禁

写自动化测试计划前，先读取 `.product-workflow-config.json` 和 `docs/product-workflow/project-profile.md`（如存在）。如果 `workflow_policy.test_automation` 为 `required`，实现型需求必须生成或阻断 `automation-test-plan.md`。如果为 `optional`，必须结合当前 PRD、测试用例和风险判断是否需要本阶段。若为 `not_applicable`，必须继承初始化原因，不得重新发明自动化范围；只有用户明确覆盖时才可继续，并记录 `explicit_override`。如果 `workflow_policy.code_exploration` 为 `user_declined`，不得静默回查源码、测试、配置或 CI。

## 输入

读取：

- `project-wiki.md`（如存在）
- `prd.md`
- `prototype.html`
- `stitch-prototype.md`
- `test-cases.md`
- `.workflow-state.json`
- Wiki Context Gate 指向的 repo wiki 或 `repo-wikis/<repo-slug>.md`
- 相关测试、配置、脚本、CI 文件和源码片段

写计划前必须区分已批准事实、wiki 导航、源码确认事实、合理假设和阻断问题。对于跨仓/跨包需求，产物先核对已有路由或授权材料中的仓库边界，再记录每个目标repo的测试入口和源码/配置依据；只写通用的 E2E/API 分层而没有目标 repo、命令和证据路径，不算完成。

## Wiki Context Gate

写 `automation-test-plan.md` 前，必须执行公共契约里的 `Wiki Context Gate`。代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

- 先判断单仓、多包、多仓或产品工作流目录边界。
- 如存在 Project Wiki，先读取仓库/包地图、Repo Wiki 状态矩阵、系统边界和待确认问题。
- 读取 repo wiki 基础页：`index.md`、`catalogue.json`、`_meta/status.md`、`shared-language.md`。
- 自动化测试阶段额外读取：`setup-and-testing.md`、`verification-gates.md`、`contracts.md` 和相关 `codemaps/*.md`。
- 涉及测试命令、fixture、mock、CI、报告路径、API、权限、schema 或 UI 行为时，必须回查源码、测试、配置或脚本。
- `automation-test-plan.md` 必须记录已读 wiki 页面、已回查路径、wiki freshness、缺口、源码冲突和采用的事实。

## AI 不确定性澄清门禁

写 `automation-test-plan.md` 前，先列出 AI 无法从 PRD、测试用例、原型、Project Wiki、Repo Wiki 和源码回查中可靠确认的自动化测试问题，并判断是否阻断当前阶段。

以下情况必须先问用户、回到前序阶段修正，或标记 `Blocked`：

- `test-cases.md` 缺少可追踪的 `AC -> TC` 映射。
- P0 自动化依赖未知测试账号、租户、测试数据、环境权限、外部集成或报告输出。
- Project Wiki 与 repo wiki、源码、测试或配置冲突，且冲突会改变目标 repo、测试层级、命令或报告路径。
- 自动化测试入口、CI/local 命令或报告产物需要靠 AI 猜测才能成立。
- 既有测试基础设施不存在，且无法定义明确的准备任务。

可继续为 `Draft with assumptions` 的情况仅限于：缺失信息不影响 P0 自动化判断，或用户明确授权按假设继续。假设必须集中列出，标明影响的 `TC`、自动化层级和回收点。

## 输出

写入或修订 `automation-test-plan.md`。产物必须包含：

- 阅读上下文：说明本阶段为什么存在、谁来评审、与 `AC/TC` 的关系。
- 自动化适用性判定：说明本需求为什么需要、可选、阻断或不适用自动化测试。
- 测试层级矩阵：`TC -> E2E/API/contract/integration/visual/a11y/smoke/regression/manual`。
- 目标仓库和 ownership：每个自动化层级落在哪个 repo/package。
- 测试环境和数据：账号、租户、角色、fixtures、seed、mock、外部依赖和清理策略。
- 测试入口和文件规划：建议测试文件路径、命名模式、可复用既有测试和影响包。
- 报告和证据：JUnit XML、HTML report、trace、video、screenshot、coverage、CI artifact 或项目等价产物。
- Local 和 CI 命令：最小本地命令、完整回归命令、CI job 或 workflow 入口和期望输出。
- 阻断项和降级策略：环境缺失、账号缺失、外部依赖不可控、flake 风险或报告缺失时如何处理。
- 实现任务建议：供 `development-plan.md` 消费的 `AUTO-TASK-xxx`。
- 单测边界：需要单测时引用 `$unit-test-init` / `$unit-test-generator`，不在本阶段生成单测。

稳定编号：

- `AUTO-AREA-xxx`：自动化覆盖区域。
- `AUTO-TASK-xxx`：自动化实现任务。
- 必须沿用已有 `AC-xxx` 与 `TC-xxx`。

写入 `automation-test-plan.md`，将状态设为 `Draft`、`Blocked` 或 `Not Applicable`，并请求明确批准。源头有更新就必须刷新看板 HTML：运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- 已执行 Wiki Context Gate，并记录 wiki 页面、源码回查路径、freshness、缺口和冲突。
- 每个 P0 `TC` 都有自动化层级、人工保留理由或阻断说明。
- 每个 `AUTO-TASK` 都能被开发计划消费，包含目标 repo、测试入口、命令和证据。
- 没有把单元测试生成职责复制到本阶段。
- 如果标记 `Not Applicable`，已经写明原因和用户/产物依据。
- 如果标记 `Blocked`，已经写明恢复条件、需要用户提供的信息和受影响 `TC`。

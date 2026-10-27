---
version: 0.9.3
name: product-develop
description: Use when the user explicitly names product:develop to implement after product workflow artifacts are approved
---

# 产品开发执行

## 命令

```text
$product:develop
$product:develop --mode=single
$product:develop --mode=multi-subagent
```

## 硬门禁

与 `../product-workflow/references/run-mode.md` 同一张表：

- **lite：** 短 `prd.md` 必须为 `Reviewed`；`development-plan.md` 必须存在、状态为 `Draft`，且含 `TASK` 与验证命令。其余裁剪阶段只查 state 中带原因的 `Not Applicable`，不要求文件，也不要求开发计划 Reviewed。
- **full 必填：** `prd.md` 与 `development-plan.md` 均为 `Reviewed`。缺则停止并请求评审。
- **full 其余方法产物**（wiki、原型各路线、test-cases、automation-test-plan、technical-solution）：`Reviewed` 或 `Not Applicable`（state 里有原因）。`Draft` 或缺文件则停止。
- 单测基建和 Git Hook：建议项。未做完时建议补；用户要先写业务则记下责任人后继续，不得标成已通过。
- 有门户绑定时，任务推进后只调用 `portalHandoff` 并记下未同步。阶段正文不拼门户命令。
- 开工前交付物核对见公共契约同名节。直接调用本 skill 时先跑那一节，再写代码。
- `portal_sync=bound_project`：按公共契约「3. 门户」处理。`portal_sync=off` 跳过本条。

## 项目初始化配置门禁

读配置、stale、open questions、`explicit_override`、`code_exploration` 为 `user_declined` 等通用规则见公共契约 § Project Init Config Gate。本阶段额外要求：配置里的单测基建和 Git Hook 是建议。缺了先告知；用户要先写业务则记下后继续。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`。用户已明确授权且既有开工门禁通过时，本阶段完成授权范围内的修复与重验；缺显式组织批准时停止，不改实现。

## 语义验证

行为变更沿实际入口实现并验证业务语义。字典规则读取真实来源，检查级联、上级过滤、已定旧值处理和空状态。按钮可点、接口返回成功或原型模拟不能当作完成证据。使用项目指定的隔离测试环境；环境不可用时写明未验证，不假称通过。

已有有效开工方式后，该方式内的可逆技术细节在读取实现后自行决定并继续，不反问 PM，也不把可逆细节写成业务决定。函数命名属于这类细节。开工方式本身仍按下文直接调用门禁：已有有效方式时继续，缺开工方式批准则检查并停止，不写代码。已确认的权限、数据源和规则保留，并按风险验证。

真阻碍只停受影响部分。可独立实现和允许验证的部分继续，并写明恢复条件。不借生产账号绕过，不伪造真实成功，不因认证缺失停掉全部工作。

这些规则不取消现行 RED、GREEN、收尾和审查门。缺显式组织批准时停止。

## 输入

前端实现先运行 `detect_design_context.mjs <项目根目录>`。命中时按 `../product-workflow/references/design-context.md` 读取 `DESIGN.md`，对照现有 token、组件和平台约束，并在 `develop.md` 记录复用项与偏差；缺 `DESIGN.md` 时不得自创视觉体系。未命中时不提示安装，仍需读取现有 UI/组件证据。

写代码前读取所有产物、当前审批状态、Project Wiki、自动化测试计划、自动化证据要求和开发计划。确认每个任务都有文件范围、仓库 ownership、验证命令和自动化证据要求。如果计划模糊，或 Project Wiki 与开发计划冲突，回到 `$product:plan`/`$wiki`，不要即兴实现。代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

已有Wiki时按公共 Wiki Context Gate 读取相关导航与主题，页面存在且与任务有关才加载；缺页不强制生成。具体实现事实按源码探查许可回查，记录来源、冲突和未覆盖范围，不把Wiki当最终证据。

full 模式默认应由 `$product:kickoff` 或 `$product:开工` 完成开工门禁和执行方式推荐后再进入本步骤。如果用户直接调用 `$product:develop`，先执行 `$product:kickoff --mode=auto` 等价检查，并推荐 `single` 或 `multi-subagent`；除非用户已经明确批准执行方式，否则不得直接写代码。lite 将开工检查内联合并在本步骤中，默认 `single`，不生成 `start-implement.md`，不增加第三道批准门。

进入实现后必须继承 `$product:kickoff` 的工程协议：先 RED 后 GREEN；multi-subagent 必须使用任务包、实现状态协议、规格符合 review、代码质量 review 和最终整体验证。不得用本 skill 的简化描述绕过 kickoff 的 TDD/review 门禁。

**计划一致性检查**：开始 TDD 前，先把用户当前需求与 `development-plan.md` 的主题、任务目标和 TC/AC 逐项比对。若需求主题与计划主题不一致，或计划缺少对应行为变更，必须将其判为范围冲突并停止，不得为了满足 RED/GREEN 形式要求而借用无关任务、伪造测试失败/通过证据或把“建议的后续任务”当作当前实现。此时只报告冲突并请求回到 `$product:plan` 或用户确认更新范围。只有计划一致且门禁通过，才进入逐行为 RED → 最小实现 → GREEN。

实现前批判性审查 `development-plan.md`。可查缺口先自行核实或回 `$product:plan` 修正；范围、验法、权限、无法按原文执行的阻断项才停在受影响任务处，其他 concern 记录风险。不能边猜边实现。

## 切片约定清单（对照已批产物）

每个任务开始实现前，从 Project Wiki / PRD / 原型提取本切片的约定条款（组件复用、边界、接口、禁造字段、编码约定），写入任务清单；实现中途不得静默偏离。偏离只能：改代码对齐，或回写 wiki 并经用户批准；禁止只改页面绕过约定。收尾时 `product-wrap-up` 会逐条对照这些条款。

## AI 不确定性执行门禁

实现前和每个任务开始前，必须识别 AI 无法从批准产物、开发计划、代码探索、工作树和用户最新指令中可靠确认的执行问题。阻断性不确定项不得写成风险后继续编码。

以下情况必须先问用户、回到 `$product:kickoff` 或 `$product:plan` 修正：

- 任务目标、关联 `TC/AC`、允许修改文件、禁止修改范围或依赖顺序不清楚。
- RED 测试入口、预期失败、验证命令、测试数据或替代验证方式无法确认。
- 当前代码与开发计划不一致，或存在会影响任务的用户无关改动。
- Project Wiki、repo wiki 状态、仓库 ownership 或验证命令与当前任务不一致。
- 执行模式、subagent ownership、review 责任、顺序边界、禁止并行实现说明或合并顺序不清楚。
- 安全、数据迁移、发布/回滚、feature flag 或环境约束会影响实现但未决。

执行阶段的阻断按当前任务范围、测试、文件 ownership 和发布风险判断；澄清、独立任务推进及授权依公共契约。授权按假设继续时，Develop tab 必须记录假设、受影响任务、验证替代方案和后续回收点。

## 代码上下文确认门禁

写代码前读 `../product-workflow/references/read-before-write.md`。代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

开始实现每个任务前必须读取开发计划指定文件，并用 `rg` 搜索相邻实现、测试、配置、表结构和调用方。涉及 Vue、WPF UI 或小程序时，按公共契约 § UI 栈参考门禁只加载目标端对应 `references/stacks/*.md`；多端任务分别加载，禁止混用框架/API。涉及多repo时，先确认仓库职责与实际证据；已有Wiki读相关入口与冲突点，缺Wiki直接核对授权材料，不要求生成。不得只按计划猜文件。若发现实际代码与 Project Wiki 或开发计划不一致，先更新前序产物或询问用户；不得擅自扩大范围。

## 执行

按 `development-plan.md` 的任务顺序执行。行为变更必须使用测试驱动开发，保留用户的无关改动，并使用计划中的命令验证。已有且已批准的验证命令需要可替换实现时，读 `references/verification-adapters.md`，按相同结果合同保存回执；实现选择不改变批准门。刚生成的测试仍交用户手动运行，不用适配器代跑。必要时把实现和验证说明回写到工作流产物。

TDD 要求：

- 每个行为变更先写失败测试，运行并记录 RED 证据；没有 RED 证据不得写生产代码。受阻测试的 RED 前置仅按下述基建暂缓路径处理。
- 确认失败原因正确后，才写最小实现；如果测试一开始通过，必须改测试直到它因预期缺失失败。
- GREEN 后才能重构，重构后必须重新运行对应验证。
- 任务完成证据必须包含 RED 命令和失败摘要、GREEN 命令和通过摘要、修改文件、覆盖的 `TC-xxx`、剩余风险。
- 无法自动化测试时，先说明原因并获得用户确认，再写替代验证。
- 新增代码必须先 RED 再写实现。测不了的遗留行走可测试性挑战，默认窄排除；抽出默认允许。

续接与停止：换会话或中断后继续，按公共契约 § 续跑与无效循环处置接下一项任务，恢复直接落回本阶段的任务循环与验证证据；重复失败且无新信息时在当前任务内停止并给恢复选项。

依赖与门禁边界：测试或构建因旧 API、废弃警告、编译错误失败时，先读 `../product-workflow/references/add-not-upgrade.md`（现版本继续，或立明确升级任务）；暂缓或装不上依赖的检查在 develop.md 记 not-run 与原因，不写成通过。

技术字符串按公共契约 § 语言和产物原样保留；本阶段差异：写进代码、配置和 develop.md 的命令段必须可原样复制执行。

**单元测试 Skill 调用策略**：

- 在实现阶段需要编写、生成、补充、修复或审查单元测试时，必须调用 `unit-test-generator` 来产出测试用例或修复建议；不得只用通用 TDD 说明代替该 skill。
- 技术方案或计划已标记测试基建缺口时，先告知并建议通过 `unit-test-init` 补齐，取得用户验证结果。用户明确暂缓、先写业务时，按公共契约 § 状态转移规则在 `waivers[]` 记录责任人、原因与范围；对应准备任务（如 `TASK-000`）保持未完成，`develop.md` 记 `not-run` 与原因，发布前补跑，不标通过。暂缓边界：仅允许在已批准的豁免范围继续编码；受阻测试对应的实现任务在补跑前不能把实现任务标为完成；原有可执行测试仍须先 RED 后 GREEN。
- 实现阶段新发现测试基建缺口时，同样先告知并建议 `unit-test-init`，回写 Develop tab 和计划缺口；用户明确暂缓时走上一条路径。不伪造 RED/GREEN，受阻测试如实记未跑；不借暂缓跳过原有可执行检查。初始化只生成脚本/配置，**不会**自动执行。
- 测试基建由 `unit-test-init` 准备；测试编写由 `unit-test-generator` 执行。任一任务未完成或没有本轮测试证据时，单元测试结果保持未完成。
- 所有由 Skill 生成的初始化脚本或测试文件必须交由用户手动运行验证，运行结果（命令、失败/通过输出）作为 RED/GREEN 证据回写 Develop tab。

**Git Hook Skill 调用策略**：

- 技术方案或计划已标记 Git Hook 缺口时，先告知并建议通过 `git-hook-init` 诊断/补齐并验证；用户明确暂缓时按 `waivers[]` 记录责任人与原因后继续业务实现，hook 准备任务保持未完成，不标通过。不删除或绕过现有正确 hook，暂缓仅针对尚未完成的基建准备。
- 若实现过程中新增或改名质量命令（例如 lint、typecheck、test、commitlint），必须记录是否需要同步 Git Hook 配置；需要同步时触发 `git-hook-init` 做诊断和保守补齐。
- 不得在实现阶段临场把现有 hook manager 迁移到另一种工具；迁移必须回到技术方案和开发计划评审。

执行模式：

- `single`：主 agent 按任务顺序逐项 TDD 实现，仅适合明显简单的低风险任务，或当前环境完全不支持 subagent。
- `multi-subagent`：仅当用户明确批准时使用。主 agent 按文件 ownership 和依赖顺序拆任务，给每个 subagent 精确任务包、文件范围、TDD 要求和验证命令；不得并行派发多个 implementation subagents。每个 subagent 返回 `DONE`、`DONE_WITH_CONCERNS`、`NEEDS_CONTEXT` 或 `BLOCKED` 状态后，主 agent 按本 skill 的状态协议处理。每个 `DONE` 任务必须先通过规格符合 review，再通过代码质量 review，两道都过才能进入下一个实现任务或合并；任一 review 不通过，该任务回到同一实现任务修复后重新走两阶段 review，不得带着未过审的改动标记完成或进入下一任务。

推荐策略：

- 除非任务明显简单，否则环境支持时推荐 `multi-subagent` 并等待用户批准；即使任务有文件重叠或先后依赖，也可通过 ownership 和顺序边界逐任务派发 fresh implementer。
- 只有单一小改动、单一文件或少量相邻文件、验证命令明确且风险低，或当前环境完全不支持 subagent 时，推荐 `single`。

## 输出

先核开工方式，再决定是否写入。full 下 `stages.start-implement.status` 不是 `Reviewed`，或 `approvals` 没有 `object` 指向 `start-implement.md` 且 `status` 为 `Reviewed` 的记录时，缺开工方式批准。此时只报告检查结果和停止原因，不创建或改写 `develop.md`，不改 `.workflow-state.json`，不写实现说明。推荐 `single` 或 `multi-subagent` 也是写入，同样停止。lite 不生成 `start-implement.md`，不套用本条。已有有效开工方式时才写入。

写入 `develop.md`。lite 至少包含 `TASK/AC` 对照、修改文件、`## 验证证据`、实际命令与结果（通过/失败/阻断/未执行）、风险和回滚；没有本轮新鲜验证证据不得请求最终批准。full 包含：

- 已实现任务
- 修改文件
- 新增或更新的测试
- 验证命令和结果
- 自动化测试计划证据：已完成的 `AUTO-TASK-xxx`、新增或更新的自动化测试、执行命令、报告/trace/video/screenshot/CI artifact；若跳过或延期，必须写明批准依据、影响的 `TC` 和恢复计划
- 已知风险或后续工作
- 回滚说明
- wiki 刷新记录：如果实现改变架构、接口、模块边界、启动方式、测试方式或重要决策，且 `docs/repo-wiki/index.md` 存在、Project Wiki 指向 `repo-wikis/<repo-slug>.md`，或当前任务允许文档更新，必须同步更新对应 repo wiki / generated repo wiki / Project Wiki 页面；如果 wiki 缺失、不可用、过期未刷新，或当前任务不允许更新 wiki，必须明确记录需要后续刷新或创建的具体页面路径和原因

源头有更新就必须刷新看板 HTML：运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在。

没有新鲜验证证据时，不得宣称开发完成。评审说明只写本轮实际执行的命令和结果；未运行的命令写成“未运行”，不写成“已通过验证”。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- 如 repo wiki 存在，已读取执行相关页面，并对实现决策回查实际源码、测试或配置。
- Develop：没有新鲜验证证据时，不得宣称完成。

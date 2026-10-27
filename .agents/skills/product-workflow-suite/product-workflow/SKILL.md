---
name: product-workflow
version: 0.9.3
description: 人点名后连跑完整产品工作流。不知道该点哪条时用 $product:ask。
disable-model-invocation: true
---

# 产品工作流

## 命令

```text
$product:workflow <需求>
```

## 使用门禁

只在用户点名 `$product:workflow`，或明确要求运行完整产品工作流套件时进入。业务用语只作导航，不新增按钮或自动路由。点名后按本次交付走到表中终点；分析、局部修改、评审交接和只读规则追踪不因此跑完整档或全部阶段。

| 用户要做的事 | 本次走到 |
|---|---|
| 分析 | 判断、依据、建议和待决事项 |
| 局部修改 | 受影响产物和需重审范围 |
| 评审交接 | 可评审规格、规则和必要验收 |
| 只读规则追踪 | 规则、片段和测试记录的偏差 |

材料承接、问题归属、存量增量、交接变更和语义验证只读公共契约同名节。分析、评审交接和只读规则追踪不写实现。用户已明确授权的项目内修复，只由通过既有开工门禁的 `$product:develop` 实现并重验；澄清准备交接，开工只检查和准备，不写实现。

完整档或轻量档才读 `references/run-mode.md` 钉档：按本条需求复杂度推荐轻量或完整并说明依据，用户确认（或强制）后写入 `.workflow-state.json` 的 `run_mode`，后续阶段只读该值。`lite` 与项目新旧无关，只在符合小改判定且用户明确确认后采用。表中的单次交付不先钉档。

## 公共契约和语言

看板迁移按 `references/common-contracts.md` 的「看板」规则执行。迁移入口负责归档原页；按缺失依赖选择就地内联或从工作流源重建，具体路径与停止条件以该契约为准。

执行本 skill 时，默认使用简体中文回复用户，并默认使用简体中文编写所有产品工作流产物（Markdown 与状态文件）。看板是派生展示，落在 `.review-board/`，不在其中另写 tab 正文。单一源头原则见 `references/common-contracts.md`。

命令名、文件路径、API 路径、代码标识符、枚举值、测试编号、验收标准编号保留原始技术形式。只有用户明确要求其他语言时，才使用其他语言。

单步阶段 skill 的共享规则集中在 `references/common-contracts.md`；完整流程执行也必须遵守其中的 Project Init Config Gate、Wiki Context Gate、语言、单问题澄清协议、产品模式协议、贯穿式不懂就问门禁、看板、制品账与门户同步、对抗审查和批准前通用自检契约。

## 输入契约

运行完整 `$product:workflow` 前，先检查活跃项目根目录是否存在 `.product-workflow-config.json` 和 `docs/product-workflow/project-profile.md`。完整档缺 config 时，必须先请用户执行 `$product:setup`（`$product:init` 是别名，仍认），生成项目级配置后再进入问题澄清。使用门禁表里的分析、局部修改、评审交接和只读规则追踪沿用已给材料，不因缺配置先跑 setup。单次评审交接不因缺配置、模式未知、commit 变化或 `user_declined` 改跑完整工作流、`$product:setup` 或 `$product:init`。如果 config 存在但 `profile_path` 指向的 profile 缺失或不可读，完整档必须请求 `$product:setup --refresh`（`$product:init --refresh` 仍认）；只有用户明确授权继续时才可继续，并记录风险。单次交付只记录缺口。如果 config 存在但 freshness 明显过期，完整档必须建议 `$product:setup --refresh`（直接跑 `$product:setup` 默认也是增量 refresh）；用户明确要求继续时，后续产物必须记录 stale-config continuation、风险和额外回查责任。单次交付不因 commit 变化停下。`explicit_override` 只用于用户明确覆盖或偏离 `workflow_policy` 或项目默认配置的情况。

完整 `$product:workflow` 必须继承 `workflow_policy.product_mode`、`clarification_style` 和 `mode_detection`。如果配置缺少 `product_mode`，视为 `unknown`；进入 PRD、原型、测试、技术方案或开发计划前，必须用一个问题确认模式，或取得用户明确授权按假设继续。按假设继续只允许下游阶段以 `Draft` 继续；不得标记为 `Reviewed`，除非用户明确接受模式假设、风险和受影响范围，并允许批准。使用门禁表中的单次交付把未知模式标成未确认，不先问模式。用户显式说明从 0 到 1或从 1 到 n时优先采用用户指定；若项目证据冲突，只问一个冲突确认问题。

完整档先把用户输入规范化为问题表格，再写下游产物。单次交付先给判断与依据，表格里的未知项写入待决。问题表格必须包含：

- 原始需求
- 目标用户
- 业务背景
- 触发场景
- 约束
- 假设
- 成功指标
- 风险
- 待确认问题

输入缺少领域、目标用户、触发场景或成功指标时，先查允许读取的既有材料；不能查明的关键业务决定按公共契约单问题澄清，其他内容可先形成带待确认项的 Draft，不编造成事实。

## 续跑与恢复

换会话或中断后继续，按公共契约 § 续跑与无效循环处置执行。本编排器的差异：恢复依据落盘的 state、阶段状态与既有产物，把结果接回阶段映射与顺序；state 与产物冲突时停在受影响阶段交回批准流程。

## AI 不确定性澄清门禁

写任何正式产物前，先判断哪些内容是 AI 无法从用户输入、既有产物或项目上下文中可靠确认的。完整档的阻断性不确定项不得只写进“假设”或“待确认问题”后继续生成完整产物，必须先问用户。使用门禁表中的分析先写判断、依据和建议，再问会改变提出方向的那一个业务决定，并完成不依赖它的内容。用户明确只要分析、不要提问时，把该项留在待决。

本门禁贯穿项目初始化、问题澄清、Project Wiki、PRD、原型、测试用例、自动化测试计划、技术方案、开发计划、开工和开发执行。按 `references/common-contracts.md` 区分可查事实、低风险假设和真正阻断；只在当前目标依赖的决策或门禁处暂停，不把每个 concern 都当 blocker。

阻断性不确定项包括会改变以下内容的未知信息：

- 目标用户、业务目标、成功指标、范围边界或非目标
- 核心用户旅程、触发场景、验收标准或优先级
- 权限、安全、隐私、合规、数据保留或审计要求
- 系统边界、集成方、数据模型、状态机、接口契约或发布/回滚策略
- 项目事实与用户表述、既有产物或代码探索结果冲突

当前产物有阻断项时，先修可查事实，再按公共契约单问题协议问最高优先级的一项；未获回答或按假设继续的授权，不提交受影响的正式产物供批准。可独立完成的草稿继续，列出未核验项和阻断范围。

## 项目上下文探索门禁

完整档或依赖仓库事实的交付才探索当前项目与仓库：写 PRD 或后续技术产物前探索当前项目/仓库上下文，不得只依赖用户一句需求或澄清产物。只改本地产物且不需要仓库事实时，沿用已给材料，不先探索仓库，也不为这次改动请求代码授权。用户拒绝读代码时，单次交付标明实现未核实，并继续不依赖源码的范围。

写正式产物前按公共 Wiki Context Gate核对任务相关事实。先读已有知识路由，再按许可回查源码/测试/配置；user_declined只读授权材料。没有Wiki不自动生成，缺证据只阻断受影响结论并请求材料。知识创建或局部更新通过Skill调用wiki；不重跑Setup或为切片复制整库。

记录已读资料、回查路径、跨仓/部署边界、冲突和未覆盖范围。已有配置required项须履行或明确覆盖，不因新默认可选静默取消。仅有commit变化不清空整套批准；受影响事实交回核对。

示例：

```bash
rg -n "CLI|cli|命令行|doctor|workflow|render|validate|token|audit" .
rg --files | rg "(cli|workflow|doctor|workspace|token|audit|scripts|docs)"
```

## 流程

正式阶段产物只在这个目录创建：

```text
docs/product-development/YYYY-MM-DD-<topic>/
```

只有用户已经给出一份有效交接路径时，才把这一份交接写到该路径。这不把全套产物改成可选，也不改用别的目录。

必需文件：

项目根目录必需初始化文件：

- `docs/product-workflow/project-profile.md`
- `.product-workflow-config.json`

产品工作流目录必需文件：

- full（`stage-gated` / `through-run`）：必有 `prd.md`、`development-plan.md`、`.workflow-state.json`。澄清、切片 Wiki、原型、用例、自动化计划、技术方案按 `references/run-mode.md` 完整档可裁剪：适用才生成，否则 state 标 `Not Applicable` 并写原因，不造空壳。
- `lite`：只生成 `prd.md`、`development-plan.md`、`develop.md`、`.workflow-state.json`；其余阶段在 state 标 `Not Applicable` 并写原因，不生成空壳。
- `.workflow-state.json` 是阶段状态的唯一源头。
- 本轮点名的阶段即使已有预置产物，也重写该阶段源头和 state。预置的 `Not Applicable` 只作输入，不能代替本轮写入。已是 `Reviewed` 的产物只在用户要求修改其内容时回改；文档整理不把未改的已评审 PRD 降为 `Draft`。

看板资源放在 `.review-board/`，不列入必交产物，不提交。每个阶段写完源头后必须运行 `render_review_board.mjs` 或 `open_review_board.mjs`。升级安装后在项目根运行：

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/product-workflow/scripts/migrate_suite.mjs" .
```

条件文件/目录：

- `stitch-prototype.md`：当采用 Stitch 路线时生成，用于记录 Stitch MCP/SDK 能力检查、项目链接、screen/frame 清单、PRD 覆盖矩阵、状态覆盖、评审缺口和恢复路径。
- `repo-wikis/<repo-slug>.md`：保留旧产物读取；新切片默认引用项目知识，用户选择后才生成。
- `.workflow-state.json` 已是必交源头（见上），状态枚举：`Draft` / `Reviewed` / `Blocked` / `Not Generated` / `Not Applicable`。禁止把状态写进 HTML。

## 阶段委托硬门禁

完整 `$product:workflow` 是编排器，不是单步 skill 的替代品。每个阶段的核心产物必须委托或等价执行对应阶段 skill 的规则；不得在完整 workflow 内用简略 bullet 直接替代阶段产物。

阶段映射：

| 阶段 | 必须遵守的 skill |
| --- | --- |
| 项目初始化 | `$product:setup` |
| 问题澄清 | `$product:clarify` |
| Project Wiki | `$wiki` |
| PRD | `$product:prd` |
| 对抗审查 | `$product:review`（`prd.md` / `development-plan.md` 写成 Draft 之后） |
| HTML 原型 | `$product:prototype` |
| Stitch 原型 | `$product:stitch-prototype` |
| 测试用例 | `$product:test-cases` |
| 自动化测试计划 | `$product:test-automation` |
| 技术方案 | `$product:technical-solution` |
| 开发计划 | `$product:plan` |
| 开工检查 | `$product:kickoff` 或 `$product:开工` |
| Git Hook 质量门禁 | `git-hook-init/SKILL.md` |
| 开发执行 | `$product:develop` |

如果当前会话无法调用某个阶段 skill，必须停止并说明缺失，不得自行生成低配替代物。若单阶段 skill 与本总流程发生冲突，以更具体的单阶段 skill 为准；只有跨阶段顺序、审批门禁和产物目录由 `$product:workflow` 统一控制。

full 阶段顺序：用户选择的Setup准备、问题澄清、按需Wiki、PRD、**review**、（适用才做）原型、测试用例、自动化测试计划、技术方案、开发计划、**review**、开工、开发执行。不适用的阶段按 `references/run-mode.md` 完整档可裁剪跳过，不委托对应 skill。`prd.md` / `development-plan.md` 写成 Draft 之后、请人批之前各跑一次 `$product:review`。`stage-gated` 时做完当前阶段即停；`through-run` 时按顺序写完**适用**阶段，PRD 与开发计划必有，两份 Draft 都要过 review。

`lite` 顺序：轻量探查并推荐模式 → 用户确认 lite → 短 `prd.md` → `$product:review` → 用户批准短 PRD → 短 `development-plan.md`（可并进 develop，仍过 review）→ `$product:develop` → `develop.md` 验证证据 → 用户批准证据。无需单独运行 clarify / Project Wiki / 原型 / 测试用例 / 自动化测试计划 / 技术方案 / 开工阶段 skill。

完整档里原型、用例、自动化计划、技术方案先套 `references/run-mode.md` 完整档可裁剪。标不适用时写进 state，不生成空壳。适用时才委托对应阶段 skill。

原型阶段在尺子判定要做时，按用户目标和 PRD 选择路线：

- HTML 路线：使用 `$product:prototype` 产出自包含 `prototype.html`。
- Stitch 路线：使用 `$product:stitch-prototype` 通过 Stitch MCP/SDK 产出 `stitch-prototype.md`；若不需要 HTML 原型，将 `prototype.html` 标记为 `Not Applicable`；若 MCP/SDK、认证、项目写入或 metadata 读取不可用，将原型阶段标记为 `Blocked`，等待用户修复或明确批准切换 HTML 路线。

所有原型路线读取已有相关Wiki与PRD中的 `原型约束契约`；Wiki缺失按公共证据门禁处理，不自动建库。若 PRD 没有该契约，必须回到 `$product:prd` 补齐后再进入原型。Stitch 路线不得在失败时自动 fallback 到 HTML。

## 看板元信息契约

编排器只补充跨阶段门禁：请求评审前核对当前阶段和上一阶段 hash，确认看板阶段、标题与 header 状态一致。其余元信息呈现和渲染完成标准以 `references/common-contracts.md` 的「看板」段为准。

- 页面初始 `<title>` 不得长期停留在“问题澄清”或旧阶段；应体现需求主题和当前最新阶段，例如 `CLI 端价值判断 - 开发计划 Draft`。
- 顶部 `header` 应展示稳定主题标题，例如 `CLI 端价值判断 - 产品工作流评审看板`，并展示当前阶段/最新进度，例如 `当前阶段：开发计划 Draft`。
- 点击顶部 tab 或通过 `#clarify`、`#project-wiki`、`#prd`、`#prototype`、`#test-cases`、`#test-automation`、`#technical-solution`、`#development-plan`、`#start-implement`、`#develop` 激活阶段时，脚本必须同步更新 `document.title` 和当前阶段提示。项目画像在 `docs/product-workflow/project-profile.md`，不是看板 tab。
- 请求评审前自检至少两个 hash：当前阶段 hash 和上一阶段 hash，确认 tab、标题、header 当前阶段提示一致。

不要手写整份 HTML。用户说「写完直接请批准」时，仍先跑渲染器，不跳过看板。每个阶段写完或改过源头后，必须运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在，再请求批准或进入下一阶段。日常打开用：

```bash
node "${CODEX_HOME:-$HOME/.codex}/skills/product-workflow/scripts/open_review_board.mjs" docs/product-development/YYYY-MM-DD-<topic>
```

也可直接打开 `.review-board/index.html`。改 Markdown 或状态后重新运行生成器更新快照。不要为同步「已评审」手写 HTML。

## 制品账与门户

完成标准见公共契约 § 制品账与门户同步。`portal_sync=off` 时不调 `limix`、不写门户状态文件。`bound_project` 只调用 `portalHandoff`，阶段正文不拼门户命令。

## 审批规则

full 模式下，项目初始化配置、Project Wiki、PRD、原型或用户确认不适用的原型、测试用例、自动化测试计划或用户确认不适用的自动化测试计划、技术方案、开发计划全部明确批准或确认可用前，不得开始实现。若用户明确确认当前单仓需求不需要独立 Project Wiki，必须在 `project-wiki.md` 或后续产物中记录“不适用”原因。如果 `product_mode` 为 `unknown`，PRD、原型、测试用例、自动化测试计划、技术方案和开发计划不得标记为 `Reviewed`，除非用户明确接受模式假设、风险和受影响范围，并允许相关阶段按该假设批准。

`lite` 只保留两道批准门：短 `prd.md` 的范围/验收/验证/不做已批准，才能实现；`develop.md` 的本轮新鲜验证证据由用户批准，切片才完成。短 `development-plan.md` 不单独请求批准，其状态保持 `Draft`。

开工前必须按公共契约 § 开工前交付物核对，并批判性审查 `development-plan.md`。先修可查或可局部澄清的问题；会改变任务验法、范围或权限的阻断项才停在开工门禁，其他 concern 写进风险清单，不边猜边开工。

full 模式开工时先使用 `$product:kickoff` 或 `$product:开工` 做执行方式推荐和门禁检查。用户已在本切片按当前内容批准执行方式时不重复索要同一句批准；未批准或范围已变仍须等待。lite 的开工检查内联合并到 develop，默认 single，不增加第三道批准门。

## 输出契约

full 模式下，薄摘要是失败产物。`lite` 例外：按 run-mode 契约使用短 PRD 和短开发计划，但范围、验收、验证命令、非目标、文件范围和回滚仍不得省略。

每个产物开头必须提供足够上下文，帮助第一次阅读的人理解：这个阶段为什么存在、谁应该评审、评审人需要做什么决策、依赖哪些前置事实或假设、关键术语/编号/角色/状态是什么意思、哪些内容尚未确认。不要让产物一开始就进入表格、编号或接口细节。

- 项目初始化：项目级画像、客户/项目现状、仓库结构、知识库现状、设计/原型默认路线、测试与发布策略、freshness、open questions、`.product-workflow-config.json` 强配置和显式覆盖规则。
- 问题澄清：目标用户、用户任务、当前流程、痛点、目标、约束、假设、风险、成功指标、非目标、待确认问题。
- Project Wiki：项目根目录、仓库/包地图、repo wiki 状态矩阵、生成或引用的 repo wiki 路径、系统边界、跨仓流程、共享契约、本地开发/验证命令、术语表、风险和待确认问题。
- PRD：完整产品背景、至少 5 条用户故事、至少 8 条验收标准、指标、范围、非目标、风险、待确认问题；必须包含“用户旅程 → 用户故事 → 验收标准”的追踪矩阵，确保旅程、故事和 AC 不脱节；涉及多角色交互或状态变化时，必须补充时序图和状态机图。面向 UI/交互的需求还必须包含“原型约束契约”，明确页面清单、入口位置、主流程、状态、字段、文案、组件/设计系统依据和禁止发挥项。
- 原型：HTML 路线产出自包含、独立、可交互的 `prototype.html`，包含代表性页面、真实操作控件、可切换状态、真实领域数据和主流程体验；不得把 PRD 背景、用户故事、验收标准、技术方案或测试用例搬进原型页。Prototype tab 负责评审上下文和追踪摘要，`prototype.html` 负责像产品一样可操作的体验。Stitch 路线产出 `stitch-prototype.md`，记录 Stitch 项目链接、screen/frame 清单、PRD 覆盖矩阵、状态覆盖、评审缺口和恢复路径；非 UI 需求也应做成交互式流程模拟器、状态机沙盒、CLI/API 控制台或等价原型。
- 测试用例：覆盖每条验收标准；普通产品需求至少 20 条 P0/P1/P2 用例，包含准备、操作、期望结果、自动化建议。
- 自动化测试计划：根据 `AC/TC` 判断 E2E、API、contract、integration、visual/a11y、smoke、regression 或人工覆盖层级；必须包含目标 repo/package、测试入口、测试数据、账号/租户/fixture/mock/seed、CI/local 命令、报告产物、阻断项、降级策略和 `AUTO-TASK-xxx`；本阶段不直接生成测试代码，单元测试仍由 `unit-test-init` 和 `unit-test-generator` 负责。
- 技术方案：架构、模块、接口字段、数据和状态变化、ER 图、API 汇总表、状态流转、错误处理、权限、可观测性、发布、回滚、备选方案、单元测试基建现状、自动化测试环境/报告要求和 Git Hook 质量门禁现状；必须标明测试框架、测试命令、报告产物、hook manager、hook stages、质量命令覆盖，以及是否需要 `unit-test-init` 或 `git-hook-init`。
- 开发计划：有序任务、可用文件/模块范围、TDD 检查点、自动化测试 `AUTO-TASK-xxx`、验证命令、期望证据、顺序边界和禁止并行实现说明；测试基建或 Git Hook 有缺口时，按 `$product:plan` 的建议口径安排 `unit-test-init` / `git-hook-init` 准备与验证；用户明确先写业务时记录责任人与暂缓，准备任务保持未完成，不将建议项另设为开工硬卡。
- full 开工：读取批准产物和开发计划，按公共契约分类并修正可查问题，核对工作树、任务独立性、文件 ownership、测试与可选 Hook；推荐 `single` 或 `multi-subagent` 执行方式。仅在未获本切片批准或出现新的阻断决策时等待用户。lite 不生成开工产物或单独批准门。
- 看板：壳 + 源文件投影，规则见 common-contracts § 看板。

## 可读性和追踪门禁

产物给人评审、给 AI 续写：Markdown 里先上下文再结论；图用 mermaid 围栏。看板只渲染源头。

每个阶段请求用户批准前，必须完成以下自检：

- 中文检查：面向用户和评审人的正文、说明、评审点、图表说明默认使用简体中文。
- 上下文检查：产物开头说明本阶段为什么存在、谁来评审、评审人要做什么决定、依赖哪些前置事实或假设。
- 厚度检查：不得只给标题和少量 bullet；必须说明业务场景、角色、触发条件、约束、规则、边界、风险和下游影响。
- 追踪检查：PRD、测试、技术方案、开发计划之间必须使用 `J-001`、`US-001`、`AC-001`、`TC-001`、`API-001`、`TASK-001` 或同等稳定编号串联。
- 图表检查：流程、状态、架构、ER、API、任务依赖、验收覆盖等复杂内容必须有可读图示或矩阵，不能只贴源码或宽表。
- 评审检查：每个 tab 必须有当前结论、风险、待确认问题和建议决策。

不接受以下产物：

- “提升体验”“降低风险”“优化流程”等没有业务上下文的空泛描述。
- PRD、测试、技术方案、开发计划各写各的，无法互相追踪。
- Mermaid 源码、宽表格或过细子 tab 直接作为人类视图主体。
- 使用未决占位词、空泛验证词或笼统边界处理表达作为正式内容。

## 看板

规则只看 `references/common-contracts.md` § 看板与套件生成器。改内容只改源头文件和 state。**源头有更新就必须刷新看板 HTML**：每个委托阶段写完后运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在，再请求批准或进入下一阶段。图写在阶段源头的 mermaid 围栏里。回到上一版：`node product-workflow-suite/product-workflow/scripts/render_review_board.mjs <工作流目录> --restore prev`。

## 单步命令

- `$product:setup`
- `$product:clarify <需求>`
- `$wiki`
- `$product:prd`
- `$product:plan`
- `$product:review`（`prd.md` / `development-plan.md` 写成 Draft 之后）
- `$product:prototype`（HTML 路线）
- `$product:stitch-prototype`（Stitch 原型）
- `$product:test-cases`
- `$product:test-automation`
- `$product:technical-solution`
- `$product:kickoff` / `$product:开工`
- `$product:develop`

`$superpowers:product-development-workflow` 是已收缩的旧入口，只转发到 `$product:workflow`。

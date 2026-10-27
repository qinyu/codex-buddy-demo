---
name: product-prototype
description: Use when the user explicitly names product:prototype to generate or revise the product workflow prototype artifact
---

# 产品原型

## 命令

```text
$product:prototype
```

## 前置条件

先套 `../product-workflow/references/run-mode.md` 完整档可裁剪：无 UI、无用户旅程 → 在 state 标 `Not Applicable` 并写原因，不生成 `prototype.html`，本 skill 完成。有界面但用户没点名 → 问一句要不要做。点名或用户要看交互 → 继续下面步骤。

使用已批准或当前正在评审的 PRD。如果缺少 PRD 上下文，先请求运行 `$product:prd`。

## 公共契约

执行本 skill 时必须遵守 `../product-workflow/references/common-contracts.md`。

## 项目初始化配置门禁

生成原型前，先读取 `.product-workflow-config.json` 和 `docs/product-workflow/project-profile.md`（如存在）。如果 `workflow_policy.prototype_route` 为 `html` 或 `auto`，本阶段可继续；如果为 `stitch`，必须先说明当前 HTML 路线与项目默认路线冲突，并请求用户明确覆盖或切换到对应路线，覆盖需记录 `explicit_override`、原因和风险；如果为 `not_applicable`，默认不产出原型，如本次仍要产出，必须明确覆盖并记录 `explicit_override`、原因和风险。如果 `workflow_policy.code_exploration` 为 `user_declined`，不得静默搜索现有 UI 或源码。

## 输入

先运行 `detect_design_context.mjs <项目根目录>`。命中时按 `../product-workflow/references/design-context.md` 读取 `PRODUCT.md` 与 `DESIGN.md`：原型必须消费已有 token、组件、平台和交互约束。命中但 `DESIGN.md` 缺失时记录设计事实缺口并先处理，不得自创视觉体系；未命中时不提示安装，继续搜索现有 UI 证据。

读取 `project-wiki.md`（如存在）、`prd.md`、PRD tab、用户反馈和现有设计/产品上下文。如果 PRD 没有明确用户旅程、状态或“原型约束契约”，先回到 `$product:prd` 补齐或向用户澄清，不要产出浅层原型。

## AI 不确定性澄清门禁

写 `prototype.html` 或 Prototype tab 前，先列出 AI 无法从 PRD、用户反馈、现有设计/产品上下文中可靠确认的原型问题，并判断是否阻断原型。阻断性不确定项不得仅写为“假设”或“待确认问题”后继续产出完整原型。

以下情况必须先问用户或回到 PRD 修正，再写原型：

- 关键用户旅程、入口、退出条件、角色权限或核心状态不清楚，导致原型主流程只能靠 AI 猜测。
- 原型应该表现为 UI、流程模拟器、状态机沙盒、CLI/API 控制台或“不适用”的判断不清楚。
- 页面/模块范围、信息架构、关键字段、操作结果、错误/空/权限状态需要用户决策。
- 现有 UI/组件/路由/设计系统证据与 PRD 或用户反馈冲突。
- 原型评审要验证的决策点不清楚，导致无法判断交互、状态或文案是否合格。

原型特有的阻断是主流程、角色权限、状态和形态；澄清顺序、Draft 与批准依公共契约。用户授权按假设继续时，Prototype tab 必须集中列出这些假设和需要设计评审回收的确认点。

请求批准原型时必须附上仍未解决的不确定项清单；用户未确认接受前，不得把 Prototype 状态写成 `Reviewed` 或“不适用已确认”。

## 存量增量

先读取现有原型或已有导航、页面和既有规则。只改本次授权范围，保留未改编号、筛选、审批和有效批准。依据缺口写进产物，不用新界面掩盖未知。

本次明确要求 HTML 时走 HTML。配置默认是别的路线时，记录 `explicit_override`、原因和风险，仍执行已定路线的覆盖门。模拟数据不能证明真实接口接通。

已核实授权范围无 UI、无用户旅程时，写 N/A 原因，标 `Not Applicable`，不生成 `prototype.html`。用户已指定 CLI 或流程说明时按该说明交付。这个判断不是人的批准：已有有效批准只留在未受影响范围；没有既有有效批准时，底层状态写 `Not Applicable`，并明确 N/A 确认仍待批，不写 `Reviewed` 或“不适用已确认”。必需记录仍保留，不伪造执行结果。仍有用户旅程时按交互控制台或状态演示交付。形态不确定时先问用户。

## 项目和设计上下文门禁

代码探查门禁（含 `code_exploration` 为 `user_declined` 时的处理）见公共契约 § Project Init Config Gate。

生成原型前必须确认该需求是否对应既有产品界面、组件库、路由、设计系统或历史原型。涉及 Vue、WPF UI 或小程序时，按公共契约 § UI 栈参考门禁只加载对应 `references/stacks/*.md`；多端分别加载，不混用 Web/XAML/平台 API。除非用户明确要求“不要看项目/不要参考现有 UI”，否则必须搜索并阅读相关页面、组件、样式、路由、设计规范、历史 `prototype.html` 或截图说明。

已有Wiki时按公共 Wiki Context Gate 读取相关导航与主题，页面存在且与任务有关才加载；缺页不强制生成。具体实现事实按源码探查许可回查，记录来源、冲突和未覆盖范围，不把Wiki当最终证据。

原型产物必须说明复用了哪些既有模式、哪些是假设、哪些需要设计评审。如果找不到相关 UI 上下文，先说明“未找到项目 UI 证据”，再基于 PRD 做独立原型；若这会影响范围判断，先问用户。

## PRD 约束消费门禁

生成 `prototype.html` 前，必须从 PRD 的“原型约束契约”提取并写入工作记录或 Prototype tab：

- 页面/弹窗清单
- 入口与信息架构
- 主流程脚本
- 状态覆盖
- 字段与真实数据样例
- 组件与设计系统依据
- 交互红线

原型必须逐条覆盖这些约束，不能只根据用户故事和验收标准自由设计。若发现契约与项目 UI 证据冲突，先回到 PRD 修订；若发现契约缺少入口、页面、关键状态或字段，先补 PRD，不得在原型阶段临场发挥。

## 输出

本阶段为 Not Applicable 时，不生成 `prototype.html`。否则创建 `prototype.html`。视觉评审有价值时，做成可在 Edge 直接打开的 HTML 原型，覆盖关键页面、状态和交互。视觉原型不适用时，`prototype.html` 说明原因，并提供等价深度的流程、状态机或 API 评审产物。已授权的简单路线仍交付对应产物。

## 禁止 Playwright / Chrome

生成或预览原型**不得**安装或启动 Playwright、Chromium、Puppeteer。现场离线装浏览器会失败（与看板出图同一类问题）。

- 「自包含」= 不引用外网 CDN，不是「用无头浏览器把图烤成 SVG」。
- 需要流程图时：在 `prototype.html` 里写 `<pre class="mermaid">...</pre>`，并引用**同目录** `mermaid.min.js`（从 `product-workflow-suite/product-workflow/scripts/assets/mermaid.min.js` 拷到工作流目录；看板生成器也会拷一份）。
- 用浏览器打开即可出图。缺库时只拷文件，不要 `npm i playwright` / `npx mermaid-cli`。
- 写完原型运行 `node ../product-workflow/scripts/prepare_prototype.mjs <工作流目录>`（相对本 skill）：脚本幂等补 Review Board 回链；页面有 mermaid 块时同时补本地脚本并拷贝 `mermaid.min.js`。不要手写这些机械资产。

## 原型独立性契约

`prototype.html` 是独立可交互原型，不是 PRD 展示页、需求说明页或评审文档。它必须让评审人像使用产品一样操作关键流程，而不是阅读长篇背景、用户故事、验收标准或方案说明。

职责分离（单一源头）：

- `prototype.html`：唯一可写源头——交互、状态、以及需要图示时的 mermaid 块。评审要点/与 PRD 契约的覆盖缺口放在页面底部 `<details id="review">`，不要另写进看板 HTML。
- 看板 Prototype tab：只展示这份文件（iframe），不烤第二份摘要。

`prototype.html` 禁止出现：

- 大段 PRD 背景、用户故事、验收标准矩阵、需求清单、技术方案或测试用例。
- 以卡片/表格罗列需求来代替界面和操作。
- 只有静态截图、流程图、说明文字或“打开某页面”的链接。
- 把“本原型要验证什么”写成长说明；最多保留 1 个简短场景标签或轻量说明。

`prototype.html` 必须具备：

- 可点击的主流程入口、下一步/返回、提交、取消或等价操作。
- 至少 2 个真实交互控件，例如表单输入、筛选、搜索、tab、下拉、开关、状态切换、弹窗、toast、抽屉、步骤条。
- 至少 3 类可切换状态，例如默认、空、加载、错误、成功、权限不足、草稿/已提交。
- 页面内状态必须由 JavaScript 或等价交互驱动变化，不能只是静态分区平铺。
- 使用真实领域数据和产品术语；数据服务于操作，不作为需求文档展示。
- 首屏应直接呈现产品界面或工作台，不得先出现大段说明页。
- 移动端和桌面端都能完成核心交互，不出现文字溢出或控件遮挡。

仍有用户旅程的非 UI 做成可交互原型：流程模拟器、状态机沙盒、CLI/API 交互控制台、权限/配置切换器或数据流演示。已核实授权范围无 UI、无用户旅程时，按存量增量交付指定说明并写 N/A 原因。形态不确定时先问用户。

## 评审框架优先级和导航约束

评审入口是看板的 Prototype tab，内容来自 `prototype.html`（隔离 iframe；看板单文件内嵌原型，修改源头后重建）。**不要为了填 tab 去改看板 HTML。** 独立打开的 `prototype.html` 只作补充的全屏预览；默认在顶部保留回到看板 Prototype tab 的链接：`.review-board/index.html#prototype`（需用 `open_review_board.mjs` 打开看板）。用户明确说无需新建看板且看板尚不存在时，不保留这条回链。

面向 UI 的 `prototype.html` 必须包含：

- 从入口到完成的主流程
- 代表性页面或面板
- 相关的空、加载、错误、成功状态
- 真实领域数据，不使用占位 filler
- 响应式布局或响应式说明
- 项目 UI/设计上下文和复用依据
- 需要图示时用同页 `<pre class="mermaid">` + `./mermaid.min.js`；禁止 CDN，禁止 Playwright 预渲染。图示只辅助交互，不能代替可点的流程。

同时必须避免以下偏差：

- 不得新增 PRD 未授权的页面、入口、主流程或业务分支。
- 不得把“用户心中所想”改写成模型自创的信息架构。
- 不得用通用 SaaS/后台风格替代项目现有 C 端交易平台风格。
- 不得用说明卡片、需求矩阵或静态流程图冒充交互原型。
- 不得因为组件缺失而发明新设计系统；必须标注 gap 或使用 PRD 允许的低保真占位。

图示只能辅助交互，不能替代交互。若同一信息既可以通过操作体验呈现，也可以通过说明文字呈现，优先做成交互。

只写 `prototype.html` 的判断性正文与交互。写完先运行 `prepare_prototype.mjs` 补回链和本地 Mermaid 资产；不要改看板 HTML。`prepare_prototype.mjs` 默认补回链和本地 Mermaid 资产，不创建 `.review-board/`。默认源头有更新就必须刷新看板 HTML：运行 `render_review_board.mjs`，确认 `.review-board/index.html` 存在。用户明确说无需新建看板时，已有 `.review-board/index.html` 时只刷新，不存在时不运行 `render_review_board.mjs`，也不另写看板 HTML；此时运行 `prepare_prototype.mjs --no-board`，只补本地 Mermaid 资产，不注入指向缺失看板的回链。可独立打开的 HTML 仍要交付，不跳过 HTML 的功能覆盖或批准请求。然后请求明确批准或“不适用”确认。

Prototype tab 由生成器从 `prototype.html` 投影，必须能看到主流程和评审缺口，禁止只放“打开 prototype.html”的链接、短摘要或截图占位。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- Prototype：覆盖主流程、异常状态、权限状态、真实领域数据和原型评审说明。
- Prototype：逐条消费 PRD 的“原型约束契约”，覆盖/缺口写在 `prototype.html` 的 `#review`，不写进看板 HTML。
- `prototype.html` 首屏是可操作产品界面，不是 PRD/需求说明。
- `prototype.html` 没有大段用户故事、验收标准、测试用例、技术方案或需求矩阵。
- `prototype.html` 至少有 2 个真实交互控件、3 类可切换状态，并能用点击/输入触发状态变化。
- 打开看板后，顶部 tab 可以切换到已有阶段；`#prototype` 能打开 Prototype tab；从 `prototype.html` 能回到看板 Prototype tab。用户明确说无需新建看板且看板尚不存在时，不要求本项，改为核对可独立打开的 `prototype.html`。
- 未使用 Playwright / Chromium / mermaid CDN。
- 若页内有 mermaid 图，工作流目录有 `mermaid.min.js`。

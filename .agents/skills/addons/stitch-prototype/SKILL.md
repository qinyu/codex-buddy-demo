---
name: stitch-prototype
metadata:
  version: "0.8.1"
  suite-id: "stitch"
description: Use when the user explicitly names stitch-prototype (trigger string remains $product:stitch-prototype) or selects Stitch as the product workflow prototype route
---

# 产品 Stitch 原型

## 命令

```text
$product:stitch-prototype
```

## 定位

本 skill 是产品工作流的 Stitch 原型路线。它与 `$product:prototype`（HTML 路线）并列。

Stitch 路线必须通过 Stitch MCP/SDK 自动化执行。MCP/SDK 不可用、未认证、无法创建或更新项目、无法读取项目 metadata、或无法验证结果时，本阶段标记为 `Blocked`，不得自动降级为 HTML。用户可以明确批准修复后重试，或明确批准切换 HTML 路线继续。

执行前还必须读取 `.product-workflow-config.json` 和 `docs/product-workflow/project-profile.md`（如存在）。如果 `workflow_policy.prototype_route` 为 `stitch` 或 `auto`，可继续按 Stitch 门禁执行；如果项目默认路线为 `html`，必须请求用户明确覆盖或切换路线，并在 `stitch-prototype.md` 中记录 `explicit_override`、原因、风险和恢复路径；如果为 `not_applicable`，默认不产出原型，如本次仍要产出，必须明确覆盖并记录 `explicit_override`、原因、风险和恢复路径。

## 前置条件

先套本机 `product-workflow` skill 的 `references/run-mode.md` 完整档可裁剪：无 UI、无用户旅程 → 在 state 把 Stitch 与 HTML 原型都标 `Not Applicable` 并写原因，不生成 `stitch-prototype.md`，本 skill 完成。用户点名 Stitch 或配置 `prototype_route=stitch` 且有界面 → 继续下面步骤。

使用已批准或正在评审的 PRD。如果缺少 PRD、PRD 没有明确用户旅程/状态、PRD 缺少 `原型约束契约`，或 PRD 没有选择 Stitch 路线，先请求 `$product:prd` 修订或向用户确认路线，不产出浅层 Stitch 原型。

执行本 skill 时必须遵守主套件 `product-workflow` 的 `references/common-contracts.md`。

## 输入

- `project-wiki.md`、repo wiki 导航和需求相关源码/设计上下文。
- `prd.md`，尤其是 `原型约束契约`。
- `.workflow-state.json`、现有 `prototype.html`，用于判断是否为组合路线。
- 项目已有 `DESIGN.md`、C5 设计约束、现有产品 UI 或用户提供的设计规则。

## SDK runner

优先使用本 skill 自带脚本接入 Stitch SDK：

```bash
node <本 skill 目录>/scripts/run_stitch_prototype.mjs \
  --workflow-dir <workflow-dir> \
  --adapter real \
  --project-title "<project title>" \
  --device-type DESKTOP
```

脚本使用 `@google/stitch-sdk`。认证必须提供 `STITCH_API_KEY`，或同时提供 `STITCH_ACCESS_TOKEN` 与 `GOOGLE_CLOUD_PROJECT`。无认证、SDK 缺失、创建项目失败、生成 screen 失败、读取 HTML/image metadata 失败时，脚本必须写入状态为 `Blocked` 的 `stitch-prototype.md`，并保留不得自动降级为 HTML 的恢复路径。

可用 `--adapter mock --mock-response <json>` 做 E2E/合同测试；mock 仅限这类自动化测试场景。真实产品交付必须使用 `--adapter real`；mock metadata（如 mock 项目 id、mock screen 地址）不得当成真实 Stitch 项目信息写进交付记录。

## AI 不确定性澄清门禁

写 `stitch-prototype.md` 前，先列出 AI 无法可靠确认的 Stitch 原型问题，并判断是否阻断。

以下情况必须先问用户或回到 PRD 修正：

- PRD 未明确选择 Stitch 或组合路线。
- 目标 surface 不清楚：web、mobile、响应式、多端或指定设备类型会影响 screen/frame 范围。
- 页面/Frame 范围、入口、主流程、关键状态、字段或交互红线不清楚。
- 设计系统来源不清楚，且会影响 Stitch prompt 或 `DESIGN.md` 注入方式。
- Stitch MCP/SDK 能力无法发现，或鉴权、项目写入、metadata 读取不可用。

用户授权按假设继续时，`stitch-prototype.md` 必须集中列出这些假设和评审回收点。

## 执行流程

S0. 从本机 `product-workflow` skill 目录运行 `scripts/detect_design_context.mjs <项目根目录>`；命中时按该 skill 的 `references/design-context.md` 读取 `PRODUCT.md` / `DESIGN.md`，缺 `DESIGN.md` 时记录缺口、不自创视觉体系；未命中不提示安装。再读取 `project-wiki.md`、repo wiki 导航、`prd.md`、`.workflow-state.json` 和既有原型产物。

S1. 从 PRD 的 `原型约束契约` 提取页面/Frame 清单、入口、主流程脚本、状态、字段、真实数据、设计系统依据和交互红线。

S2. 确认 Stitch 是当前选定路线。若不是，停止并请求路线确认。

S3. 发现 Stitch MCP/SDK 能力：优先运行 `run_stitch_prototype.mjs` 的 real adapter；记录工具名、认证状态、可用操作、项目创建/更新能力、metadata 读取能力。不得硬编码未经发现的工具方法名。

S4. 若能力发现、认证或写入检查失败，写入 `stitch-prototype.md`，状态为 `Blocked`，记录失败原因和恢复路径，然后停止。

S5. 基于 PRD 和项目 UI 上下文生成 Stitch prompt。prompt 必须包含页面/Frame、主流程、状态覆盖、真实字段、示例数据、设计系统依据和交互红线。

S6. 注入或引用 `DESIGN.md`。若项目没有 `DESIGN.md` 或可信设计规则，记录设计系统 gap，不得伪造。

S7. 调用 Stitch MCP/SDK 创建或更新项目。若使用 runner，确认其 `stitch-prototype.md` 输出包含 `@google/stitch-sdk` 能力检查、Project ID/Link、screen/frame 清单和 HTML/image metadata。

S8. 读取 Stitch 项目 metadata，包括 project id/link、screen/frame 清单、生成或更新时间、预览/导出能力。

S9. 对照 PRD `原型约束契约` 做覆盖检查。至少记录 3 类状态覆盖；不足时标记 Draft 缺口或 Blocked，具体取决于是否影响主流程评审。

S10. 写入 `stitch-prototype.md` 和 `.workflow-state.json`，运行 `render_review_board.mjs` 刷新看板 HTML，确认 `.review-board/index.html` 存在，再请求用户评审。

## `stitch-prototype.md` 必须包含

- 阅读上下文：评审目的、评审人、依赖的 PRD/Project Wiki 事实。
- MCP/SDK 能力检查：工具名、认证状态、支持操作、失败摘要。
- Stitch 项目信息：project id/link、screen/frame 清单、生成或更新时间、预览/导出说明。
- Prompt 包：从 PRD 约束生成的 Stitch prompt。
- `DESIGN.md` 使用：导入文件、生成规则或 gap。
- PRD 覆盖矩阵：每条原型约束映射到 Stitch 证据或缺口。
- 状态覆盖：至少 3 类状态及 screen/frame 证据。
- 评审缺口：生成偏差、缺失 screen、设计系统问题或人工决策点。
- 恢复路径：Blocked 时如何修复 Stitch，或如何由用户批准切换 HTML 路线。

## Prototype tab 契约

看板 Prototype tab 是主评审入口，由 `stitch-prototype.md` 投影，不能只放 Stitch 外部链接。源头必须包含 Stitch 项目信息、screen/frame 清单、覆盖矩阵、状态覆盖、缺口和恢复动作。

如果同目录同时存在 `prototype.html` 和 `stitch-prototype.md`，Prototype tab 必须展示组合路线，不得互相覆盖。

## 验证命令

执行或维护本 skill 后，至少运行：

```bash
rg -n 'stitch-prototype|\$product:stitch-prototype|stitch-prototype\.md' SKILL.md
```

该命令必须能匹配 skill 名、命令和 `stitch-prototype.md` 产物契约。

## 请求批准前自检

- 已执行公共契约中的批准前通用自检。
- 已读取并逐条消费 PRD 的 `原型约束契约`。
- MCP/SDK 能力检查已记录，失败时状态为 `Blocked`。
- `stitch-prototype.md` 包含 project id/link 或明确失败原因。
- Prototype tab 不只是 Stitch 链接。
- 已记录至少 3 类状态覆盖，或明确说明为何阻断。
- 未把 Stitch 生成偏差写成已批准事实。

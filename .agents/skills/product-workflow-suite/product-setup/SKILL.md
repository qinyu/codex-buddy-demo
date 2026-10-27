---
name: product-setup
description: 准备项目材料、选择知识整理与工作流配置，定稿项目章程。
disable-model-invocation: true
---

# Setup

用户执行 `$product:setup`；`--refresh` 只重查变化与未完成项。Setup负责准备与章程，知识任务交给 `wiki`。

## 1. 认工作区与已有规则

先读当前目录适用的 AGENTS.md、CLAUDE.md 与已有 `.product-workflow-config.json`。确认用户要准备的项目根；嵌套仓库遵守各自规则。已有代码直接复用。只有文档也可开始；没有代码时问是否接入，允许拒绝或稍后自行复制。

拉取前确认来源、落点与授权，沿用本机凭据；已有目录有内容时先核对，不覆盖。材料到位后重新识别项目根、仓库边界与章程，再执行后续步骤。失败只续跑受影响项。需要登记多个仓库时可用主套件 prepare_workspace.mjs，只登记与检查，不clone；返回awaiting-authorized-clone后由Setup核对授权再执行Git拉取，不交给Wiki。

已有回答和明确选择直接复用。缺少Setup不阻止分析、草稿、只读追踪或评审；正式实施仍遵守批准与证据门禁。

## 2. 选择准备范围

最低交付是有效 AGENTS.md。问清用户要最小准备还是产品工作流配置；只补缺失决定。最小模式不要求 Git、门户、profile 或索引。

源码探查与Wiki生成分别征求许可。`code_exploration=user_declined` 时只读授权材料；拒绝建Wiki不等于拒绝读代码。现有政策为 required 时尊重原批准；本次改变需明确覆盖并记录理由。

授权内轻量了解项目类型、仓库/部署边界、已有文档、测试与未知项，不运行安装、构建或全仓扫描。完整模式按 `references/workflow-config.md` 生成配置与画像；门户选择为 `portal_sync=off` 时不调用limix、不创建 `.limix-artifacts.json` 或门户sidecar。接入协议、CLI检测与接入选择都按 `references/portal.md` 执行；项目说明路径仍为 `docs/product-workflow/portal.md`，Setup只把选择写入本地配置；未同步只报告事实，不阻断本地已批准开发；内容冲突不静默选边。外挂发现按 `references/addons.md`，未命中说明跳过。设计上下文使用主套件 detect_design_context.mjs 只读探测 PRODUCT.md / DESIGN.md，已有设计事实只引用，不重复问询；未命中不生成设计占位。完整工作流的设计契约通过 product-workflow Skill 提供的 design-context.md 使用，Setup只记录已有证据入口。

## 3. 推荐 Wiki

结合材料说明当前知识缺口、建议整理范围、收益、成本和不整理的影响。用户可选择复用、补缺、创建或暂不整理。已有README、ADR、Wiki可直接引用，不机械建第二套树。

用户同意后通过 Skill 调用 `wiki`，传项目根、授权材料/源码范围、任务(create/query/update)、目标范围、已有知识入口及明确选择。Wiki返回实际产物、证据、冲突与未完成项。缺少Wiki时最小Setup仍可完成，所选知识任务记缺依赖；不自动安装。

深度代码图和LLM模块梳理是Wiki内部的独立可选分支。根据任务需要推荐，不凭固定行数强制启用。拒绝或失败不伪装知识就绪。

## 4. 定稿章程

完整模式先确认会影响后续门禁的政策（尤其测试自动化、单测门禁）。缺用户决定时在此停下提问，只可写草稿profile；不要先落盘config或完整章程再补问。用户只说“完整配置”不等于批准所有默认策略。

材料、所选知识结果和必要政策确定后，由Setup统一定稿 AGENTS.md。最小模式只加载 `references/minimal-charter.md`，使用独立minimal marker，不套用完整模板；完整模式才加载 `references/charter-rules.md` 与 `references/agents-charter-template.md`，沿用其托管冲突保护。已有CLAUDE.md保留并协调入口，避免两份冲突规则。

最小模式在章程托管区域简短记录：用户明确的源码探查许可、Wiki选择及有效资料入口、项目稳定约束和仍未知的事实。完整模式config/profile承载政策，章程只写稳定规则与条件指针。两处冲突先确认，不能猜许可。路径必须实际存在；新资料尚未产生则写未完成，不填假链接。

修改托管块前查重用户正文；人工修改与模板冲突时停该块，只请用户裁决块内差异。仅检查或refresh不重问模式、领域、源码与Wiki选择；这些选择未变且与冲突无关时留待用户另行请求。保持无关内容不变。无变化重跑不改写章程。

## 5. 交付

报告实际根目录、选择、已完成项与剩余缺口：
- 最小初始化完成：AGENTS.md可用，明确选择可跨会话读取。
- 完整工作流可用：配置经用户确认、所选必需项验证通过；不以最小完成替代。
- 部分受阻：指出受影响项、证据与恢复入口，其余可用项保留。

基础知识后续由Wiki局部更新；Wrap-up按变化调用Wiki，不重跑Setup。仅政策或章程改变才请用户执行 `$product:setup --refresh`。

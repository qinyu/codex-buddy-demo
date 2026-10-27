## Agent skills

### Issue tracker

GitHub Issues on `qinyu/codex-buddy` via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

<!-- BEGIN product-workflow charter suite=v0.9.3 -->
<!-- product-workflow charter source-sha256=8a592b2c3f630f6541b5dba3762c4045ccab07137e2b91e4e7b85d41fe7f2923 -->
## product-workflow 套件规则

（本块由套件维护：改动走套件升级，不手编；块外为用户内容，套件不触碰）

> 规则举一反三：示例不穷尽，同类工具、依赖、构建脚本、wrapper 一律适用同一原则。

### 跟随现状

- 版本与依赖只增不改：语言 SDK 与运行时、包管理器、框架、依赖、构建脚本与 wrapper 沿用仓库现有版本；新依赖增量添加，选型在现有版本基础上做。
- 编码跟随文件现状：改前先探测原编码并跟随；新文件 UTF-8 无 BOM。
- 风格跟随现有系统：原型与界面改动以现有设计系统为准。
- 检查范围跟随变更清单：编码 / BOM 只查本次改动文件。

### 写入（Windows）

- 写文件用原生写入（Set-Content / [IO.File]::WriteAllText），显式指定编码；apply_patch 在 Windows 沙箱不可用。
- 同一写入连续失败 2 次即停下报告；批量写入合并成脚本一次执行。
- 细则（BOM / GBK 探测、PS 版本判定、乱码处理）：读套件 charter-rules.md §R07/§R08。

### 工作流

- 新切片走产品工作流；阶段深度按切片裁剪：可跳过（Not Applicable）、可复用已批准产物、可轻量合并；PRD 与开发计划必有，允许轻量形态。
- 人点名才连跑：`$product:workflow`。不知道该点哪条用 `$product:ask`。项目 Setup 用 `$product:setup`。阶段命令：`$product:prd`、`$product:plan`、`$product:review`、`$product:kickoff`（`$product:开工`）、`$product:develop`。
- `prd.md` / `development-plan.md` 写成 Draft 之后、请人批之前跑 `$product:review`。
- 交付件：不选门户则 `portal_sync=off`，只维护本地制品账，不调 `limix`、不写门户状态文件。用软件门户则 `bound_project`。开工遵守本地批准与证据门禁；门户未同步报告事实，不阻断已批准本地开发，门户内容冲突先裁决。
- 门户时机：阶段写成 Draft / Reviewed 不是自动上传。开工硬卡通过后自动同步一次，然后确认开工。切片实现收尾：写 `slice_wrap_up`，绑了门户再报任务完成并请全员确认收工。对人说人话和链接，不念命令。
- 豁免可先写业务代码；测试状态如实标注，跑通的才算通过。
- 遗留套件走增量覆盖：新增代码必须有单测；不可测的遗留行摊给用户，默认窄排除，不为追覆盖做可测试性大重构。
- 开发完成后回写文档与状态。
- 中文输出、中文注释。
- 三方 skill 按时机调用：项目级做一次并复用，需求级按阶段接入。
- 交付件分层存放：进仓资产与进度记录分开；项目级长期维护，需求级按切片保存。
- 能脚本生成或校验的文件不要手写；AI 只写判断性正文。

### 行文

- 给人看的文字要好懂：先说结论，再用证据。
- 同等元素字数接近、句式一致；换行不要留下一两个字的孤行。
- 总结和介绍要能单独转发：版本、做什么、怎么用、不做什么。

### 状态

- AI 只能把阶段状态写为 Draft / Blocked / Not Applicable；Reviewed 由人批准后写入。
- 已批准产物再修改 → 状态回 Draft，state 标 revising（看板显「已回改待复审」）。

### 设计上下文

- 原型或界面实现前先读现有 UI、设计系统、token、组件和 `DESIGN.md`（如有）；没见过现有设计证据不得自创风格。
- 探测到 impeccable 或 `PRODUCT.md` / `DESIGN.md` 时按项目级接入，后续切片只读复用；未探测到时不提示安装。
- `PRODUCT.md` 是用户、任务、平台、约束的事实源；`DESIGN.md` 是设计事实源，其它文档只引用不复制。

### 输入

- 有效稿、必要图与未读影响按套件公共契约 § 有效输入与缺失信息处理执行；记录在既有产物，不另建清单。

### 代码知识库

- 基础知识按实际Wiki结果记录入口；代码增强的 `query_ready=true` 仅表示可尝试查询，MCP或shell均可。Setup根据Wiki返回的证据维护章程与既有marker；Wiki不回填。未启用增强不等于基础知识未接入；user_declined时不查图、不读源码。
<!-- END product-workflow charter -->

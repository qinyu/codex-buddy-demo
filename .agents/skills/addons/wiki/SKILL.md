---
name: wiki
metadata:
  version: "0.9.1"
  suite-id: "wiki"
description: >-
  Use when creating, querying, or incrementally updating project knowledge from
  existing documents or permitted source code, including repository maps,
  cross-repository context, onboarding, module relationships and change impact.
  Setup and Wrap-up use this skill for knowledge tasks; code graphs and LLM
  module modeling are optional branches, not prerequisites for basic Wiki work.
---

# Wiki

统一处理知识的创建、查询和增量维护。Setup管材料接入、策略选择和章程；Wiki管知识事实与导航。先复用，再补缺。

## 1. 接收任务契约

调用方通过Skill传入下列字段；这是本次任务的交接内容，不写成全局配置：

| 字段 | 含义 |
|---|---|
| `task` | 按最终交付选择：只回答是query，新建页面是create，修改已有页面是update；图查询作为取证操作单列在graph_ops |
| `workspace` | 工作区位置，只用于解析路径，不授予目录内内容读取许可 |
| `targets` | 要查询或更新的页面；新建页为输出目标；未知填unknown |
| `read_scope` | 分别列 `docs` 与 `source` 的获准文件/目录，以及对应用户授权；空列表表示未获准，未知填unknown |
| `write_scope` | 获准写入的文件/目录及授权；查询默认空列表 |
| `graph_ops` | 分别列获准仓库的query/build/sync；默认空列表，安装另行授权 |

`read_scope.docs`约束业务文档，不用于禁止读取适用AGENTS、已有策略配置与执行所需skill规则；规则文件的读取不授予其写权限，也不扩大业务文档范围。“不改章程”保持只读，不解释成禁止读取适用规则。workspace使用绝对路径；仓库路径尚未知时保留unknown，可在已给定工作区内核对Git根，不能假定所有子仓都获准。

已有调用方传来的旧字段或自然语言请求仍可用：先整理成上述契约，只复述已给出的事实和许可。unknown不是全仓许可；路径相关、目录可访问、页面存在也不是授权依据。调用方只是传递用户许可，不能凭这张表替用户批准。

**业务读取前检查契约。** 定点任务需要目标和相应取证许可；目标未知时，只有原授权覆盖的文件名定位可以继续。内容许可缺失且任务无法完成时返回具体缺口。已足够的任务直接执行，不为填表增加确认轮次。图查询、建图、同步分别检查，任何一项都不扩大文档范围。

读取适用AGENTS.md与已有config/profile；配置缺失可继续使用用户明确授权的材料，不因此启动Setup。明确任务 `create` / `query` / `update`、工作区、目标主题、允许读取和写入范围、已有知识入口。Setup/Wrap-up传来的选择直接复用；只问缺失决定。

在读取业务材料、搜索或诊断前，先选证据类型并加载规则：文档/授权源码读 `references/basic-knowledge.md`；需要代码图、符号或调用影响时先读 `references/code-analysis.md`；模块梳理读 `references/module-map.md` 与 `references/llm-wiki.md`。已选执行器模式另读 `references/authorized-operations.md`，按第2节核对模式和许可。直接自然语言取证仅兼容，不承诺读取合规。完成条件：已读所选分支，并能列出本次获准动作；然后进入下一节。图只能通过公开接口取得证据，图库文件本身不属于可读业务材料。

分别判断探查与生成许可。`user_declined`源码探查时只读授权资料；拒绝Wiki生成仍可查询已有资料。旧project_wiki=required保留原批准语义，改变需明确覆盖；not_applicable不是重新劝用户建库的理由。

## 2. 选择取证路径

仅调用方或用户明确选定时使用执行器；未选定时使用自然语言兼容路径。兼容路径按第1节整理原许可，授权足够直接执行，不要求补authorization_confirmed字段；显式待确认或authorization_confirmed=false时保留该停止条件。执行器模式按下述确认门槛执行，模式切换由调用方或用户决定。源码与图查询许可不包含README等业务文档；docs、source、graph_ops逐类核对，许可不足只请求缺失项。

授权边界采用第1节契约。业务读取前只列**本次取证**：完成当前问题要读/搜的具体路径与图查询目标；每项须落在read_scope或graph_ops内。**逐项点名**：每次业务内容读取、搜索或诊断前，列明该调用实际访问的路径并核对本次取证列表，核对通过才执行；批量调用逐项检查。目录列举与Git诊断也逐项核对目标路径；报告路径只授权该路径，定位报告时也只检查该路径。适用规则按第1节加载，单列为规则读取。新增目标先指出要补的证据：已有授权覆盖时更新取证目标后继续；超出授权时停下，请求具体的扩展许可。章程、配置与skill用于确定规则，不把其目录当作业务阅读许可。

### A. 定点处理

指定文件或局部事实更新走此路径，完成后直接到第5节，不进入B。

1. 先列出本次取证清单：目标页、获准证据和每项依据。路径未知时只返回授权定位范围内的候选文件名。兼容路径按已有授权直接取证。已选执行器模式：交接已含 `authorization_confirmed=true` 且清单未超出交接范围时，直接由执行器读取；未确认清单停下，确认回复到达后才读取。在该模式下，写后复读目标页也由执行器读取，获准范围内的搜索和读取也由执行器执行。
2. 核对目标陈述与证据。**待改陈述已定位、新值已由证据确认、没有妨碍本次修改的未决冲突：取证结束，下一步编辑。** 查询任务则直接返回答案。
3. 只修改目标事实；多页任务对列明的目标逐页处理。证据缺失或冲突时报告缺口并停下。

### B. 知识发现

只有建立导航、跨页查询或梳理未知结构才走此路径：从授权入口开始，在授权范围内沿相关链接按需取证。没有限定目标不等于全仓文档授权；范围不足先问清。已有入口包括 `docs/repo-wiki/`、`docs/project-wiki/`、切片 `project-wiki.md`、README/ADR/runbook。

搜索范围与任务授权一致：定点任务逐文件指定；明确授权目录发现时可在该目录内搜索。内容访问包括read、搜索命中、shell/脚本及诊断工具，换工具不改变授权。新增证据按上述授权边界判断；获准源码探查或图查询均不扩大文档范围。

仅目标页未定或已发现相关冲突时确定权威页：现有明确指针优先；多份冲突列出证据并请用户裁决，不同时生成两份答案。保留旧路径，跨仓写入需逐仓授权。新单仓默认 `docs/repo-wiki/index.md`，跨仓默认 `docs/project-wiki/project-wiki.md` 作路由；只有需要的页面才创建。已有深度模块页 `docs/project-wiki/wiki/` 以链接接入，不复制。

生成与更新细则见 `references/basic-knowledge.md`。

## 3. 按任务执行

- query：定位相关页，核对出处与新鲜度；需要代码事实时按授权回查，返回具体路径/行号、事实与未知项。知识缺失不是强制建库的理由。
- create：先确认范围与写入位置；从已授权证据抽出最小导航和必要主题页，区分已确认事实、代码推断与待确认项。
- update：按本次取证核对受影响主题，只更新已发生且有证据的长期事实。计划、草稿与未实现方案不写成当前事实；实现偏离批准约定时报告偏差，不改Wiki掩盖。
- tour：用户要 code tour / onboarding tour / 架构走读 / PR tour / explain how X works 并要保留可复用路径时，先读 `docs/repo-wiki/index.md`、`catalogue.json` 和相关 `codemaps/`；按读者角色定步数（`new-joiner` 9-13 步、`vibecoder` 5-8 步、`architect` 14-18 步、`pr-reviewer`/`security-reviewer`/`feature-explainer` 7-11 步）；每步锚定真实文件、目录、行号或模式，不猜行号；写 `.tours/<persona>-<focus>.tour`，讲 orientation → module map → core path → gotcha → next move 的路径，不做平面文件清单。

## 4. 可选深度分支：AST 代码图谱与 LLM Wiki

基础Wiki不依赖Python或CodeGraph。当获得代码探查与建图授权时，按下列工程思路与两步推进流程执行深度架构梳理：

1. **AST（抽象语法树）确定性图谱底座**：
   - 避免通用文本切片破坏代码语法与调用链。利用 AST 解析精准提取类、函数、头文件引用与调用拓扑（Callers / Impact），沉淀确定性的符号图谱底座，提供精准的 `path:line` 真实代码行号证据，不受向量漂移干扰。
2. **LLM Wiki 编译型维基思想**：
   - 践行 Andrej Karpathy 的 LLM Wiki 模式：在提问前，由大模型通读源码自顶向下“编译”并沉淀为一套面向实体与接缝规则（Modules & Seams）的本地 Markdown 活页笔记。实现双会话解耦（会话 A 专职研读编译，会话 B 日常开发仅消费紧凑 Wiki，单次消耗极低 Token）。
3. **具体推进步骤（先画模块，再形成梳理模板）**：
   - **第一步：先画模块**：基于 AST 提取的工程结构，按 `references/module-map.md` 梳理出顶层业务模块与适配器边界（`module-or-adapter`），定义统一的领域业务命名与对外接缝规则（`seam-rule`），输出全局模块拓扑图并经开发人员审查确认；
   - **第二步：形成模块梳理模板**：按 `references/llm-wiki.md` 标准模板，为每个核心业务实体与通信协议生成标准化活页笔记（核心职责、对外公共 Seam、关键源码位置 `path:line`、状态机与异常边界），并在根目录 `index.md` 建立全局导航索引，形成规范活页体系。

图结果不代表业务模块理解，模块草稿仍需用户确认。Windows脚本执行用PowerShell；内部CLI的工作目录为Wiki skill根，路径含空格时正确引用。安装、建图、重建需要相应授权；没有工具、图过期或调用失败时报告具体原因，基础知识任务继续用授权材料。`query_ready`只表示可尝试，不证明查询成功。派生图与缓存保存在本地并排除Git；人工维护Markdown单独处理。图表/HTML仅按需生成。

## 和其他 skill 协作

知识整理不替阶段自创读法：需求、技术方案和开发计划分别由 `$product:prd`、`$product:technical-solution`、`$product:plan` 的契约决定。遇到拆任务或安排实施，交给 `$product:plan`，只提供事实与证据。设计上下文按授权读取 PRODUCT.md / DESIGN.md；主套件可用时使用 detect_design_context.mjs 的只读结果，不在Wiki重复建立设计事实源。完整阶段通过product-workflow Skill的design-context.md契约消费这些证据。

## 5. 返回可核对的结果

git status、git diff --name-only、git rev-parse 只核对文件状态，不能证明没有读取。写入前记录Git变更路径作为已有修改基线；写后再次列路径（git status --short 或 git diff --name-only），只复读本轮目标页和新建页，核对事实。结合实际写入调用区分用户已有修改与本轮改动；本轮越出write_scope标为边界失败，既有变更不归给本轮。路径列表不能证明既有脏文件未被再次修改；记录不足时保留未核对项，不为验证而打开范围外内容。完成条件是目标事实正确、本轮写入均获准。返回任务与范围、实际读取证据、创建/更新的路径、未变更部分、冲突和未完成项。完成、无需修改、等待确认和失败都交付访问清单：规则读取、业务读取/搜索、目录列举与Git诊断、图操作、写入，逐项对照实际调用与返回；未发生项写无，未知项留缺口。

访问核对覆盖 read、搜索、shell、Python、CLI、嵌套调用的实际返回，不以计划、是否引用或文件是否修改判断。工具已返回内容就记为读取，即使未用于答案。执行器收据只证明该批次，不覆盖前后会话。授权依据区分用户原话许可、调用方已确认交接和本轮整理的请求字段；引用实际依据，执行器接受true只证明字段通过检查，不证明用户新增确认。自动审计未覆盖、未解析或疑似诊断需人工核对，不自动通过，也不把异常当读取。边界结论只有三态：发现违规即如实报告边界失败；记录不足注明访问核对未完成；只有完整实际调用与返回均已核对且符合授权，才写边界通过。已证明违规不因记录缺口降级。“未修改”与“未读取”分别说明。无变化时明确无需更新。图查询需给实际调用路径与结果，不用“已接入”代替调用证据。

Wiki不改Setup章程托管块；发现策略或知识入口变化时向调用方提出必要修改。Wrap-up仅记录本次实际知识更新；缺材料或依赖时如实留缺口，不宣称同步完成。

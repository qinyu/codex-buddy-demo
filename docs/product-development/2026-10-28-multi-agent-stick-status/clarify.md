# 多编码助手状态与确认请求上 Stick

本澄清稿用于确定现有 Codex Usage Stick 的增量范围，供产品负责人评审并决定是否进入 PRD。评审重点是多助手状态如何识别与呈现，以及多个权限请求同时等待时如何避免错认对象。产品模式为 `one_to_n`，由用户于 2026-10-28 明确确认；完整工作流采用逐阶段评审（`stage-gated`）。

## 需求与业务背景

- **原始需求**：多个编码助手同时工作时，我想在 Stick 上看到谁正在工作、谁需要确认。
- **目标用户**：使用多个编码助手并通过 M5Stack StickS3 查看状态、处理权限请求的人。此定义来自需求语义，具体用户群与使用环境尚未确认。
- **业务背景**：Codex Buddy 已有多助手 Agent Hub，通过本机 Unix socket 接收 hook 事件，并在 Stick 上轮播助手状态；Stick 已可显示 Codex 权限请求并以按键批准或拒绝。
- **系统范围**：用户已确认首版仅聚合同一台电脑上的本机 bridge 与一台 Stick；不包含跨电脑或跨 Stick 同步。
- **会话标签**：用户已确认 Stick 标签显示助手名、项目目录末级名称和会话短标识；不显示完整路径。稳定会话标识存在时取短标识；否则由本机 bridge 分配本次运行短序号。来源未提供明确工作目录时显示“未知项目”。
- **首版助手范围**：用户已确认仅覆盖 Codex、Pi、Hermes、Cursor 和 DSH；并明确把 DSH 的实际 hook/adapter 接入纳入本切片。
- **当前痛点**：需要在多个助手或会话之间识别正在工作的对象，并辨认哪些权限请求属于谁；如果只展示汇总状态，可能无法定位应确认的助手或会话。

## 产品模式与澄清方式

- `product_mode=one_to_n`，来源为用户明确选择“现有产品增量演进”。
- `clarification_style=single_question`，`mode_detection=explicit`，继承项目配置与用户本轮选择。
- 按 one-to-n 顺序优先核验当前系统事实、状态/会话识别、兼容性与权限边界，再确定增量验收范围。
- 不存在尚未确认的产品模式假设；以下未决项主要涉及交互决策和成功指标。

## 项目上下文与证据

### 已确认事实

- 仓库导航：`docs/repo-wiki/index.md`；系统边界：`docs/repo-wiki/architecture.md`；验证入口：`docs/repo-wiki/development.md`。
- Agent Hub 现有 `HubAgent` 记录 `agent_id`、显示名、状态与可选 `session_id`；状态 hook 将 `UserPromptSubmit`、`PreToolUse` 等映射为工作中，将 `PermissionRequest` 映射为 `attention`，`SessionEnd` 会移除对象。证据：`tools/codex_usage_ble_bridge.py:212-240`、`:261-270`、`:445-480`。
- 现有 roster 是按助手 ID 存储，`session_id` 仅是字段，非对象身份键；当前 Stick packet 只携带当前助手名称/ID、轮播索引和总数。证据：`tools/codex_usage_ble_bridge.py:405-423`、`:445-480`、`:586-600`、`:733-744`。
- 权限桥接会把待确认请求排队，Stick 当前逐个显示请求的工具/提示，并通过 A/B 按键提交决定。权限 IPC 的关联目前是桥接生成的 prompt ID，不含助手/会话归属展示。证据：`tools/codex_usage_ble_bridge.py:1820-1844`、`:1978-2045`、`src/main.cpp:914-955`、`:1770-1782`。
- 多助手 hook 适配已有插件文档与脚本入口；通用 tee 可把 Ping Island 形状 hook 同时送往 Stick Agent Hub。证据：`plugins/codex-usage-stick/README.md:91-112`、`tools/agent_hub_hook_tee.py`。
- 现有 Agent Hub 测试覆盖事件映射、多个助手状态、会话结束、超时与轮播，但未证明多会话拆分及并发确认归属。证据：`tools/test_agent_hub.py`。
- 配置 `portal_sync=off`；不进行门户写入。切片 Wiki 复用现有 `docs/repo-wiki/`，本阶段不另建 Wiki。

### 本次搜索记录

- 关键词：`agent hub`、`session_id`、`PermissionRequest`、`attention`、`agent_count`、`approval`、`carousel`。
- 实际命令：`rg -n -i "agent hub|agent-hub|multi-agent|multiple agents|agent count|需要确认|waiting approval|working" README.md REFERENCE.md docs plugins tools src`；`rg -n "def state_from_hook_event|def apply_to_snapshot|PermissionRequest|UserPromptSubmit|PreToolUse|PostToolUse|Stop|SessionEnd|attention_window|busy_window|agent_count" tools/codex_usage_ble_bridge.py plugins/codex-usage-stick/scripts/hook_entry.py tools/test_agent_hub.py`；并回读 `src/main.cpp`、`src/data.h`、`tools/codex_usage_ble_bridge.py` 与插件 hook 文档的相关片段。
- 命中确认：已有 Agent Hub、按 agent ID 聚合的轮播、单个活动权限请求视图及 A/B 设备决策；会话字段存在但当前未作为独立身份；测试具备 packet seam。
- 未确认：不同 hook provider 是否总能提供稳定 session/thread ID；不同助手的权限请求格式、是否允许多挂起请求及超时语义；Stick 列表浏览控件与队列切换方式是否需要改动；当前功能目标可接受的误识别率和刷新延迟。

## 用户任务与当前流程

1. 编码助手产生状态 hook，bridge 依据助手标识更新 Agent Hub 对象。
2. bridge 轮播当前助手的状态 packet，Stick 显示助手名、工作状态和轮播位置。
3. 权限请求通过 hook 或 Codex approval 通道进入 bridge 队列；bridge 将队首请求发给 Stick。
4. Stick 显示请求类型与摘要，用户按 A 批准或 B 拒绝；bridge 将决定送回请求方，再呈现下一条。

当前关键缺口是助手对象按类型聚合而不是按会话区分；权限请求还没有明确的助手/会话归属显示。状态 hook 缺失或身份字段不稳定时，Stick 当前无法保证展示正确归属。

## 触发场景

1. **并行工作**：Codex 与 Cursor 同时处理不同任务，用户需要识别哪些助手仍在工作。
2. **同类型多会话**：两个 Codex 会话并行执行，用户选择按助手实例/会话分别显示，不能合并成单一 Codex 条目。
3. **多个确认等待**：不同助手的权限请求先后或同时进入队列，用户要求逐条显示，并在 Stick 上批准或拒绝；每条请求必须清楚标识其来源。
4. **会话结束/超时**：助手会话结束或 hook 暂停，Stick 应停止把已结束对象标成工作中；具体保留和过期规则仍需制定。
5. **来源身份缺失**：某客户端没有稳定 session/thread ID 时，需避免把请求错误关联到另一个活动会话；降级呈现规则未定。

## 目标、范围与非目标

### 目标

- 让用户在 Stick 上区分不同编码助手实例/会话，并看到谁在工作、谁等待确认。
- 多个待确认请求按条呈现；每条显示来源身份及足以识别请求的摘要，用户可在 Stick 上批准或拒绝。
- 不因增加多助手/会话区分而破坏既有 Codex 单会话状态显示与权限回退行为。

### 初步范围

- Agent Hub 的会话/实例身份、状态生命周期、轮播/摘要 packet。
- 多来源 hook 身份提取与缺字段回退。
- 权限请求与来源会话的关联、队列展示、设备端决策回传。
- 固件显示与按键导航，以及 bridge/协议/插件测试和兼容验证。

### 非目标（待 PRD 确认）

- 为未接入 hook 的助手自动安装或修改其配置。
- 构建通用团队监控平台、云端同步或历史活动分析。
- 改变 Stick 既有用量仪表、BLE 安全和权限决定语义；必要的兼容修正除外。
- 未经用户确认，不把会话提示词、完整命令或敏感路径上传到外部服务。

## 约束、假设与风险

- **约束**：现有架构为本机 bridge 经 BLE NUS 向 Stick 发送 JSON；固件有有限屏幕和实体按键；首版限定单机单 Stick；`portal_sync=off`。
- **假设**：所支持的编码助手可通过 hook/适配器提供稳定会话标识，或可提供可解释的降级标识。该假设必须经协议事实核查，不能直接作为全量支持承诺。
- **权限风险**：将批准/拒绝操作绑定到正确请求非常关键；超时、队列推进、重复点击、请求取消和旧 prompt 的迟到决定都必须防止误决策。
- **隐私风险**：显示项目/路径、命令摘要可能暴露敏感信息；设备上的文本范围与脱敏规则需明确。
- **兼容风险**：NUS JSON packet、Codex 插件 hooks 和其他助手的 hook 语义可能不同；既有协议消费者及老固件需核实兼容策略。
- **可用性风险**：在有限屏幕逐条看多个实例与请求可能增加确认耗时；必须明确紧急提示是否打断当前视图以及队列切换方式。
- **验证边界**：Python 测试和 PlatformIO 编译无法单独证明 BLE、实体按键和真实 Codex 权限闭环；设备端验证需在获准开工后规划。

## 成功指标（待定量）

- 用户能在设备上正确区分并行工作的助手会话，且同类型并发实例不会被合并。
- 每个待确认项在显示来源、请求摘要和队列顺序方面可判定；决定返回的请求与用户选中的条目一致。
- 已结束/超时对象不会持续显示为工作中；缺失身份的请求不会错误归属到其他会话。
- 既有 Codex 单会话状态与单权限请求流程保持兼容。

目前没有可依据的数值基线、支持助手名单或延迟阈值，不编造百分比/秒数目标；进入 PRD 前需确定可测口径，或明确接受以行为验收为主的首版指标。

## 待确认问题与不确定性队列

| 顺序 | 待确认项 | 来源与影响 | 当前是否阻断 |
|---|---|---|---|
| 1 | 如何界定状态刷新延迟和同时展示/排队容量？ | 决定性能验收与屏幕可用性边界。 | 不阻断澄清；PRD 根据现有 bridge 推送周期和屏幕空间定义可测刷新上限及有界 roster/队列的超量行为。 |
| 2 | 会话结束后状态/实例卡片保留多久？ | 影响状态生命周期与误报。 | 不阻断澄清；现有 `SessionEnd` 会移除 Agent Hub 对象，PRD 建议延续；短时 completed 展示沿用现有过渡语义并引用实际配置。 |
| 3 | 请求摘要是否允许显示命令、路径或理由？ | 影响隐私、安全及 Stick 小屏文案。 | 不阻断澄清；用户已选择项目目录仅显示末级名称、无明确目录显示“未知项目”；PRD 建议请求摘要最小披露、截断展示、不增加外发或持久化。 |

本轮用户已确认的六项关键决策：**按助手实例/会话分别显示**；**标签显示助手名、项目目录末级名称和会话短标识**；**缺少稳定会话标识时由 bridge 分配本次运行短序号**；**没有明确工作目录时显示“未知项目”**；**首版支持名单为 Codex、Pi、Hermes、Cursor、DSH，包含 DSH 实际接入**；**多个待确认请求逐条显示并在 Stick 上批准/拒绝，且只限同机本地 bridge + 一台 Stick**。上述用户旅程、支持范围、显示原则和系统边界已足以形成澄清阶段 Draft。刷新阈值、队列容量、结束态保留和摘要最小披露可作为 PRD 中带依据的具体建议提交评审，并非当前阻断。

## 进入 PRD 前评审清单

- [x] 按实例/会话而非助手类型汇总。
- [x] 多个待确认请求逐条排队展示，并支持在 Stick 上批准/拒绝。
- [x] 首版只覆盖同一台电脑的本机 bridge 与一台 Stick。
- [x] 确认会话标签为助手名、项目目录末级名称、会话短标识；缺稳定 ID 时分配本次 bridge 运行短序号，无明确工作目录时显示“未知项目”。
- [x] 确认首版助手名单为 Codex、Pi、Hermes、Cursor、DSH。
- [x] 确认 DSH 实际 hook/adapter 接入纳入本切片。
- [ ] 确认显示隐私边界与请求摘要规则。
- [ ] 确认状态刷新、请求队列容量与可测成功指标。

## 建议评审决策

建议批准当前澄清结论。仍未量化的刷新、容量、结束态展示和最小披露细节可在 PRD 中依据实现事实提出可判定规则，不改变已确认用户旅程、系统边界或支持名单。

## 澄清阶段结论

用户已于 2026-10-28 明确评审并批准本澄清稿。批准后按 `stage-gated` 进入 PRD。PRD 必须核实 DSH hook/adapter 的具体接入契约，不能把当前仅接受 `client_kind: dsh` envelope 的行为误写成 DSH 已完成接入。

## PRD 启动时发现的阻断决策

已批准的需求要求在 Stick 上批准/拒绝排队请求，但当前可核实的设备决策回传只存在于 Codex `PermissionRequest` hook 与 Codex approval socket；Pi/Hermes/Cursor 目前接入的是状态 hook，DSH 尚无稳定 hook surface。不能把“状态接入”推断为它们的权限请求都可被设备安全决策。

用户于 2026-10-28 明确接受以下设备端决策边界：首版只对已经验证完整设备决策闭环的请求在 Stick 上批准/拒绝；其它助手只显示正在等待确认，决定回到各自原生 UI。理由是避免将 Codex 的 allow/deny 语义误投递给其它助手。该决定影响权限用户旅程、AC、安全边界和适配器范围，按用户明确答复记录。

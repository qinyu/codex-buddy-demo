# 多助手 Stick 状态与确认测试用例（Draft）

本阶段把已批准 PRD 与已批准原型转成可判定的验证清单，供产品负责人、开发和测试评审。评审重点是助手会话隔离、设备审批权限门、超时/撤销安全、隐私与旧固件兼容；测试用例不代表实现已存在或已执行。

## 阅读上下文

- 产品模式：`one_to_n`，来源为用户 2026-10-28 明确确认；本阶段沿用既有 Codex Buddy 仪表、BLE 与权限 overlay，覆盖多助手会话、请求逐条处理和 DSH 实际 adapter 范围。
- 业务依据：已批准 `prd.md` 的 J-001..003、US-001..006、AC-001..010；已批准 `prototype.html` 仅提供屏幕交互形态参考，不作为 bridge、adapter、BLE 或设备审批闭环通过证据。
- 评审角色：用户 / 产品负责人确认预期语义；开发核对接口前提与自动化可行性；测试核对步骤和可观察结果。P0 为错误授权、跨会话串扰、隐私泄露或阻断上线的范围失败；P1 为主流程/生命周期/兼容行为错误；P2 为边界可读性、刷新时效及恢复体验问题。
- 风险重点：设备决定必须绑定当前有效 request ID 与来源；非 Codex 默认不能通过 Stick 决策；来源没有可关联会话标识时不得伪造多个会话；DSH 接入必须依据受支持接缝和真实事件，而非合成 envelope。
- 现有测试上下文：`tools/test_agent_hub.py` 使用 Python 标准库 `unittest`，覆盖当前按助手聚合的 hook 身份、状态、轮播、超时和 packet；`tools/test_provider_quota.py` 覆盖额度 packet；`tools/test_serial.py`、`tools/test_xfer.py` 会连接实体设备，不是离线单测。`docs/repo-wiki/development.md` 记录上述入口。未发现统一 pytest/CI 配置或已证实的全仓单测命令；建议离线用例复用 `python3 -m unittest tools/test_agent_hub.py tools/test_provider_quota.py` 模式，设备与原生助手闭环另列手工/集成验证。以上是建议，不是本轮执行结果。

## AC 到测试区域追踪

| 验收标准 | 用例 |
|---|---|
| AC-001 同助手多会话独立 | TC-001、TC-002 |
| AC-002 稳定 ID / 运行期短号 / 无法关联降级 | TC-003、TC-004 |
| AC-003 cwd 末级名和缺省值 | TC-005、TC-006 |
| AC-004 状态更新、结束、超时 | TC-007、TC-008、TC-009 |
| AC-005 多条请求队列逐条处理 | TC-010、TC-011 |
| AC-006 设备决策授权门与原生 UI 回退 | TC-012、TC-013 |
| AC-007 当前请求绑定、撤销、重复/迟到/断连安全 | TC-014、TC-015、TC-016、TC-017 |
| AC-008 DSH 真实 adapter 与事件生命周期 | TC-018、TC-019 |
| AC-009 单机隐私边界 | TC-020、TC-021 |
| AC-010 旧 packet / Codex / 仪表与按键兼容 | TC-022、TC-023 |

## P0：安全与身份正确性

### TC-001 同一助手两个稳定会话隔离
- 对应 AC：AC-001、AC-004；优先级：P0
- 准备：Agent Hub 离线测试实例；两条来源明确的 Codex session fixture `cx-01`、`cx-02`；固定时钟。
- 步骤：1) 对 `cx-01` 发 `UserPromptSubmit`；2) 对 `cx-02` 发 `UserPromptSubmit`；3) 查询 Hub roster 和 Stick packet 会话条目；4) 对 `cx-01` 发 `SessionEnd`。
- 测试数据：同助手、不同稳定 session ID，cwd 分别为 `/work/alpha` 与 `/work/beta`。
- 期望：出现两个独立条目；结束 `cx-01` 只移除该会话，`cx-02` 仍为工作中；不得因同助手而覆盖或合并。
- 自动化建议：Python `unittest` 扩展 AgentHub/packet seam；设备显示另做 StickS3 手工验证。

### TC-002 并发事件交错不串会话
- 对应 AC：AC-001、AC-004；优先级：P0
- 准备：与 TC-001 相同，两会话 fixture 可并发投递。
- 步骤：1) 交错发送 A busy、B attention、A Stop、B SessionEnd；2) 检查各会话状态与 roster；3) 轮播到 A 并确认身份标签。
- 测试数据：A=`cx-01`，B=`cx-02`；事件顺序按步骤。
- 期望：A 的 Stop 不结束 B；B 的结束不改变 A 状态；每个状态只归属对应 session ID。
- 自动化建议：并发/交错事件单测；真实 hook 生命周期做集成抽样。

### TC-003 稳定会话 ID 短标识
- 对应 AC：AC-002、AC-003；优先级：P0
- 准备：输入来源稳定 ID 的事件及 packet 序列化检查。
- 步骤：1) 发送 `session_id=0123456789abcdef`；2) 再发送同 ID 的活动事件；3) 读取会话标签和设备 packet。
- 测试数据：Codex 稳定 ID `0123456789abcdef`，cwd `/work/alpha`。
- 期望：使用该稳定 ID 的短标识，后续事件保持同一条目；完整 ID/cwd 不被额外泄露到设备字段，项目只显示 `alpha`。
- 自动化建议：Hub 映射与 packet 字段白名单单测；截断碰撞需技术方案确定算法后补例。

### TC-004 无稳定 ID 时运行期序号与不可关联降级
- 对应 AC：AC-002；优先级：P0
- 准备：两组 fixture：可关联的临时句柄事件；完全没有稳定 ID、临时句柄或可关联上下文的事件。
- 步骤：1) 同一临时句柄发送两条活动事件；2) 另发一条不同临时句柄事件；3) 重启 Hub 后重放；4) 再发无法关联的两条事件。
- 测试数据：临时句柄 `tmp-a`、`tmp-b`；无句柄事件仅含助手类型和状态。
- 期望：同次运行中 `tmp-a` 后续事件复用同一短序号，`tmp-b` 独立编号；重启后不承诺号码稳定；无法区分/关联的事件不得伪装成两个可追踪实例，应降级为单一未知会话或忽略并可观察。
- 自动化建议：Hub 身份映射单测；进程重启边界用临时目录的集成测试。

### TC-005 仅显示明确 cwd 的末级项目名
- 对应 AC：AC-003、AC-009；优先级：P0
- 准备：hook 来源明确提供 cwd；检查 bridge 内部标签和 BLE packet。
- 步骤：1) 上报 cwd `/Users/dev/private/customer-x`；2) 查看 Stick roster packet；3) 搜索 packet 中路径片段。
- 测试数据：上述 cwd。
- 期望：显示 `customer-x`；packet 不含完整 cwd 或父目录；不得使用插件安装目录作为项目名。
- 自动化建议：packet 断言和敏感字段扫描单测。

### TC-006 cwd 缺失、无效或来源不明
- 对应 AC：AC-003、AC-009；优先级：P0
- 准备：cwd 缺失、空字符串、无效类型、仅 bridge/plugin cwd 四类 fixture。
- 步骤：逐个输入 fixture，读取最终身份标签与 BLE packet。
- 测试数据：cwd 为 `null`、`""`、数组，以及不携带 cwd 但宿主进程有工作目录。
- 期望：均显示 `未知项目`；不能从 bridge/plugin 工作目录补值；packet 不泄露完整路径。
- 自动化建议：字段降级与隐私白名单单测。

### TC-007 SessionEnd 只终止匹配会话
- 对应 AC：AC-001、AC-004；优先级：P0
- 准备：同一助手两个活跃 session 的 Hub fixture。
- 步骤：给其中一个 ID 发送 SessionEnd；检查 roster、当前页索引和另一条状态。
- 测试数据：`cx-01`、`cx-02`；先结束 `cx-02`。
- 期望：只移除 `cx-02`；`cx-01` 保留；轮播索引有效，不跳到错误会话。
- 自动化建议：AgentHub session lifecycle 单测；A/B 轮播设备手工验收。

### TC-008 busy / attention / completed 状态按生命周期变化
- 对应 AC：AC-004；优先级：P1
- 准备：可注入时钟的 Hub 和状态事件 fixture。
- 步骤：分别发送工作、权限请求、完成事件；越过各状态时限并执行 tick。
- 测试数据：`UserPromptSubmit`、`PermissionRequest`、`Stop`，推进时间超过各自窗口。
- 期望：事件更新到对应状态；超时不残留 BUSY/ATTN/DONE；无 hook/进程证据时不能把 unknown/offline 伪装成 IDLE。
- 自动化建议：固定时钟状态机单测。

### TC-009 迟到、重复和未知 hook 事件不误删 roster
- 对应 AC：AC-004；优先级：P1
- 准备：两个同助手 session 的顺序事件 fixture。
- 步骤：1) 结束 A；2) 重发 A 的迟到活动/重复结束事件；3) 检查 B 和未知 session 条目。
- 测试数据：A=`cx-01`、B=`cx-02`；迟到事件携带已结束 A ID。
- 期望：迟到事件不得清除 B 或错误复活已结束 A；重复结束幂等；未知事件不创建错误归属。
- 自动化建议：Hub 事件序列单测。

### TC-010 多条待确认请求逐条呈现
- 对应 AC：AC-005、AC-006；优先级：P0
- 准备：一条已验证 Codex 设备闭环请求、一条非闭环 Pi 请求；不同 request ID 与会话。
- 步骤：1) 并发入队；2) 通过 Stick 当前 prompt 查看首条；3) 决定或撤销首条；4) 检查下一条。
- 测试数据：Codex `req-c1`/`cx-01`，Pi `req-p1`/`pi-01`。
- 期望：同一时刻只呈现一条；顺序可见、来源和会话准确；下一条只在当前条目完成/撤销后出现；不合并批准/拒绝。
- 自动化建议：approval queue 单元/集成测试；实体 Stick 验证屏幕容量与按键。

### TC-011 设备决定只作用于当前 request ID
- 对应 AC：AC-005、AC-007；优先级：P0
- 准备：至少两个并发 pending 请求，设备当前显示队首 ID。
- 步骤：对当前显示项做一次决定；随后核对原始请求回执、队列下一项及其状态。
- 测试数据：`req-c1`、`req-c2`，来源/会话分别匹配。
- 期望：只有当前 request ID 收到匹配决定；下一条不被同一次按键决定；各自来源不串。
- 自动化建议：proxy/queue 单测与带真实 Stick 的端到端验证。

### TC-012 非闭环助手不暴露有效批准/拒绝
- 对应 AC：AC-006；优先级：P0
- 准备：Pi、Hermes、Cursor、DSH 的确认请求，未实现经验证回执闭环。
- 步骤：逐个显示请求；尝试触发对应 A/B 设备键；检查来源原生权限流程和 bridge 输出。
- 测试数据：每种助手各一条 pending request，request ID 可以缺失或无回执目标。
- 期望：Stick 明确提示“回 `<助手名>` 确认”；不存在可执行 approve/deny；按键不发送决定、不阻塞原生权限流程。
- 自动化建议：设备 packet/UI 状态测试，加各来源原生 UI 人工检查。

### TC-013 未知 request ID、来源或回执目标时关闭设备决策
- 对应 AC：AC-006、AC-007；优先级：P0
- 准备：用例注入 request ID 缺失、来源未知、session 不可关联、回执目标缺失的请求。
- 步骤：每种请求进入提示路径，尝试在设备端按 A/B 并观察 hook/bridge 返回。
- 测试数据：四种分别缺失一个授权必要字段的请求对象。
- 期望：所有未满足闭环门槛的请求只给原生 UI 提示；没有默认 allow，也不以通用助手类型误开放决策。
- 自动化建议：授权门禁单测；失败关闭必须做安全回归。

### TC-014 超时 / 原生 UI 已处理后旧按键不落到下一条
- 对应 AC：AC-005、AC-007；优先级：P0
- 准备：两条 pending，第一条设备 prompt 当前显示；可控制时钟及原生撤销事件。
- 步骤：1) 让第一条超时或由来源 UI 处理；2) 让队列显示第二条；3) 注入第一条 prompt 的迟到 A/B 消息。
- 测试数据：第一条 `req-old`，第二条 `req-next`，决策消息携带 `req-old`。
- 期望：旧 prompt 先清除；迟到决定被忽略/拒绝；`req-next` 仍待处理，绝不收到该决定。
- 自动化建议：proxy 异步测试覆盖 timeout/cancel/stale ID。

### TC-015 重复决定、未知决定和未知 ID
- 对应 AC：AC-007；优先级：P0
- 准备：单条有效请求以及已消费、未知 ID 的设备消息 fixture。
- 步骤：对有效 ID 决定一次后重复发送；再发送未知 ID 和非法 decision。
- 测试数据：有效 `req-1`；重复 `req-1`；`req-404`；decision=`maybe`。
- 期望：仅首个有效决定被消费；重复/未知/非法消息不改变其它 pending；不得默认 allow，日志避免带完整敏感提示内容。
- 自动化建议：device message handler 单测。

### TC-016 BLE 断连与 bridge 无响应安全回退
- 对应 AC：AC-007、AC-009；优先级：P0
- 准备：Codex pending 请求；分别模拟 BLE 断开、Stick 不回执和 Unix socket 不可达。
- 步骤：断连发生后等待 hook 超时/原生 fallback；确认设备与 bridge 状态；恢复连接后检查是否重放旧 prompt。
- 测试数据：Codex pending request `req-c1`；断连期间不提供决策。
- 期望：不自动批准；Codex hook 按现有行为回原生 UI；过期提示清除，重连不将旧按键套用新请求。
- 自动化建议：socket/超时集成测试；BLE 断连、重新配对和 Stick 状态需实体设备实测。

## P1：实际接入、隐私与兼容

### TC-017 原生 UI 提前完成与请求撤销竞态
- 对应 AC：AC-007；优先级：P1
- 准备：Codex 当前设备 prompt；可并发触发来源原生决定与设备按键。
- 步骤：在竞态窗口分别先后提交原生决定和设备决定；重复多轮并检查 RPC 回执。
- 测试数据：同一 request ID 的 allow/deny 两种冲突决定。
- 期望：同一请求至多消费一次；冲突/迟到动作失败关闭；不影响队列后项。
- 自动化建议：asyncio 并发/竞态测试；实际 Codex app-server 路径集成确认。

### TC-018 DSH 受支持接缝和真实生命周期接入
- 对应 AC：AC-008；优先级：P0
- 准备：先记录 DSH 官方/受支持 adapter API 与版本、安装 profile 和生命周期契约；若此证据不存在，本用例标记阻断，不能用模拟数据替代。
- 步骤：1) 安装/启用真实 DSH adapter；2) 启动真实 DSH session；3) 触发 start/activity/end；4) 检查本机 bridge、Hub 与 Stick 路径及来源标签。
- 测试数据：真实 DSH profile、session、cwd；测试日志保留版本和事件 ID，不保存完整 prompt/token。
- 期望：真实事件经本机 bridge 到 Stick；助手身份为 DSH，session/cwd 字段正确或按 AC-002/003 降级；若没有受支持接缝或路径缺失，AC-008 判失败并阻断交付，回产品负责人评审范围，不得静默跳过。
- 自动化建议：真实 adapter contract/integration 测试；受支持接缝确认属于前置证据，由负责 DSH 接入的开发提供。

### TC-019 五种助手身份映射与来源隔离
- 对应 AC：AC-001、AC-008；优先级：P1
- 准备：Codex、Pi、Hermes、Cursor、DSH 各来源事件 fixture 和未知类型 fixture。
- 步骤：按助手分别上报 start/activity/end；检查映射、会话 roster 和状态归属；再发送未知助手类型。
- 测试数据：五类规定标识与一个未支持 kind。
- 期望：固定映射为 Codex、Pi、Hermes、Cursor、DSH；未知类型不冒充首版助手；每个来源的事件只更新自己的会话。
- 自动化建议：身份映射表驱动单测；真实接入分别做 adapter contract 测试。

### TC-020 BLE packet 最小披露与字段白名单
- 对应 AC：AC-009；优先级：P0
- 准备：包含完整 cwd、完整命令、token/凭据标记的源 payload；packet 捕获测试替身。
- 步骤：1) 输入含敏感标记的事件；2) 捕获实际待写 BLE JSON；3) 搜索标记及禁止字段。
- 测试数据：`/Users/test/private-project`、`SECRET_TOKEN_SENTINEL`、完整命令 sentinel。
- 期望：设备 packet 只含批准显示所需助手/短项目/短会话/状态/必要摘要；不含完整 cwd、token、密钥、完整 prompt 或任意原始 hook 对象。
- 自动化建议：序列化输出白名单单测与敏感 sentinel 扫描。

### TC-021 本机数据路径与无持久化历史
- 对应 AC：AC-009；优先级：P1
- 准备：启用多助手状态事件及权限提示；检查相关 socket、日志、BLE 目的端和新增存储。
- 步骤：触发状态和 pending request；观察通信目标与运行后本机文件变化；检查是否有云端请求或新增历史库。
- 测试数据：一次状态事件、一条权限请求。
- 期望：多助手 hook/权限消息只经本机 socket 与已配对 Stick BLE；没有外部服务传输或持久化请求历史；日志不含未允许的完整敏感负载。
- 自动化建议：socket 集成测试、网络出口监测与文件系统差异检查；人工审查用户授权路径。

### TC-022 旧版 JSON packet 与固件兼容
- 对应 AC：AC-010；优先级：P1
- 准备：旧版仅含 `agent`/`agent_id`/index/count、额度字段的 JSON fixture；新固件测试实例。
- 步骤：输入旧 packet 到 `src/data.h` parser；检查额度、agent chrome、角色状态和屏幕信息页。
- 测试数据：从现有 bridge 构造的旧格式 packet，不包含新增 roster 字段。
- 期望：旧字段继续解析；额度与既有单 agent 行为不变；未知新增字段不导致旧设备/旧 packet 崩溃。
- 自动化建议：parser fixture 单测（现有固件测试入口未确认）；`pio run -e m5stack-sticks3` 仅证明编译，不能替代设备兼容验收。

### TC-023 额度仪表、角色状态与既有 Codex 审批回归
- 对应 AC：AC-010；优先级：P1
- 准备：既有额度 packet、角色动画状态及 Codex `PermissionRequest` / app-server approval fixtures。
- 步骤：依次显示仪表、切会话、进入 Codex 审批并完成决定；检查 quota bars、persona、overlay 和 fallback。
- 测试数据：额度 5h/weekly 样例、Codex permission prompt、Stick A/B 输入。
- 期望：用量字段与视觉不被 roster 更新破坏；Codex 完整闭环仍只回当前 prompt；原生 fallback 行为保留。
- 自动化建议：复用 `tools/test_provider_quota.py`、`tools/test_agent_hub.py` 模式；设备渲染、BLE 与完整 Codex 闭环手工/端到端验证。

## P2：可见性与容量边界

### TC-024 空 roster、unknown/offline 与恢复
- 对应 AC：AC-003、AC-004、AC-010；优先级：P2
- 准备：空 roster、来源不明会话、BLE 断开、bridge 停止和恢复输入。
- 步骤：分别进入空状态、unknown/offline；恢复来源或 BLE；观察显示变化。
- 测试数据：无活动会话；无 hook/进程证据；重连后一个活动 session。
- 期望：明确区分空、offline、unknown，不伪装 IDLE/BUSY/ATTN；恢复后显示真实上报会话；额度旧展示兼容。
- 自动化建议：状态映射单测；错误/恢复提示在 Stick 上手工验证。

### TC-025 会话 / 请求高并发容量与不丢请求
- 对应 AC：AC-005、AC-010；优先级：P2
- 准备：可注入递增数量的会话与 pending 请求；BLE packet 大小测量工具。
- 步骤：从两条开始逐步增加并行会话及待确认请求；每次比对队列计数、请求 ID、BLE 消息大小和屏幕分页；达到容量上限时继续投递。
- 测试数据：多助手混合会话与请求，包含长项目名/摘要但不含真实敏感内容。
- 期望：显示总数/当前位置或明确容量边界；不因截断而静默丢挂起请求；超出容量时安全保留并明确提示，不出现错误决定归属。
- 自动化建议：桥接队列/packet 压测与最大 BLE payload 边界测试；上限数值待技术方案和实体设备测量后确定。

### TC-026 Stick 标签长度、横竖屏与实体按键可读性
- 对应 AC：AC-003、AC-006、AC-010；优先级：P2
- 准备：设备竖屏/横屏构建；长助手项目名、短 ID、未知项目、请求摘要、native fallback 请求。
- 步骤：轮播会话；进入设备可决策及 native UI 提示页；用实体 A/B 操作并检查标签裁切和控件提示。
- 测试数据：`customer-integration-worktree`、`RUN:04`、短摘要及较长工具名。
- 期望：助手名、项目末级名、会话 ID 至少可辨识；请求页来源、项目、session、类型/最小摘要同时可见；非闭环来源无 A/B 决策提示；按键语义符合既有实体交互。
- 自动化建议：真实 Stick 截屏/目视验收；离线测试不能证明像素布局与按键体验。

## 未决项与回收

- DSH 受支持 hook/plugin 接缝和目标版本尚无仓内证据：由负责 DSH 接入的开发在技术方案阶段核实；影响 AC-008 / TC-018。无有效接缝则按 PRD 失败并回产品负责人裁决，不以假设通过。
- 无稳定 ID 时的来源临时句柄字段、多个不可关联事件的策略由各 adapter 技术核验；影响 AC-002 / TC-004。用例保留 PRD 规定的安全降级，不假设各来源必然提供字段。
- 最大 roster / pending queue 容量、BLE payload 上限以及身份短标识冲突处理尚未测定：由 bridge/固件开发在技术方案阶段测量；影响 AC-005 / TC-025、TC-026。当前用例验证“不静默丢失/不误决策”，不预设具体数量。
- 固件 parser 的离线单测入口与统一测试命令尚未确认：由开发在自动化测试计划阶段探测；影响 AC-010 / TC-022。现存 `tools/test_serial.py` 与 `tools/test_xfer.py` 会访问硬件，不能作为默认离线门禁。

## 评审要点

请评审 P0 授权失败关闭与会话隔离用例是否充分，确认 DSH 接缝缺失时按阻断处理，确认非闭环助手原生 UI 回退不能被 Stick 按键绕过。未决技术项列于“未决项与回收”，当前不阻断这些安全规则的用例草稿；容量和固件验证命令在技术方案 / 自动化计划阶段回收。本阶段仅定义测试，不修改代码、不生成 fixture、不运行测试。

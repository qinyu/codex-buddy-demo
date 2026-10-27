# 自动化测试计划：多助手 Stick 状态与确认（Draft）

本阶段把已批准测试用例 `TC-001..TC-026` 分配到单元、接口/契约、集成、端到端和人工实测层，供用户、开发和测试评审。计划范围是本仓 Codex Buddy 的本机 bridge、插件/adapters 与 Stick 固件，不新增远程服务、CI 或依赖。自动化计划不等于测试已实现、执行或通过。

## 阅读上下文与适用性

- 产品模式：`one_to_n`，用户于 2026-10-28 明确选择按现有产品增量演进；复用已有 Agent Hub、Codex approval socket、BLE NUS 和 Stick 仪表，新增会话级身份、状态及 DSH 实接入，并守住现有 Codex 决策闭环。
- 已批准输入：`prd.md`（AC-001..AC-010）、`prototype.html`（交互参考）和 `test-cases.md`（TC-001..TC-026）。原型只模拟交互，不作为真实链路验证证据。
- 适用判定：需要工程自动化。需求新增会话关联、请求队列与授权约束、多来源 adapter、设备 packet 以及兼容行为；项目配置 `workflow_policy.test_automation=required`，不能以人工回归替代全部自动化要求。
- 评审人：用户 / 产品负责人确认安全边界与阻断策略；开发确认可维护的测试接缝、命令与责任归属；测试确认环境隔离、证据产物和层级覆盖。
- 本期不执行测试、不创建测试代码/fixture、不刷写固件、不改用户助手配置。计划里的命令是建议或仓库当前入口，均明确标注事实等级。

## Wiki / 源码上下文与证据边界

- 配置与模式：读取 `.product-workflow-config.json`、`docs/product-workflow/project-profile.md`；代码探查允许，产品模式为 `one_to_n`，自动化要求为 `required`，门户同步为 `off`。
- Repo Wiki 已读：`docs/repo-wiki/index.md`、`docs/repo-wiki/architecture.md`、`docs/repo-wiki/development.md`。Wiki 导航版本声明为 2026-10-28 检出的 `main` `da47804f908313906d6a0a71f7665d9b7f9daa5b`，当前 HEAD 为 `f0310834aad84c55bbe3ab38a3ed5e2e1e8d7461`；因此 wiki freshness 与当前 HEAD 不一致，只作导航，以下关键事实均回查当前源码。Wiki 无 `setup-and-testing.md`、`verification-gates.md`、`contracts.md` 或 codemap 页面；单仓实现也没有 Project Wiki，未生成额外知识文档。
- Bridge / Hub：`tools/codex_usage_ble_bridge.py` 中 `AgentHub` 以助手 ID 建 roster，`HubAgent.session_id` 目前仅单值，不支持同助手多 session 独立 roster；`UsageSnapshot.packet()` 仅输出 agent、agent_id、index/count 和额度字段；`CodexApprovalProxy` 有 pending/request ID、超时与设备消息匹配机制。上述为实现现状，不是本切片新增能力的通过证据。
- Hook / adapter：`plugins/codex-usage-stick/scripts/hook_entry.py` 实际实现 Codex permission socket 与 Agent Hub 通知；Pi/Hermes 模板位于 `integrations/agent-hub/pi/index.ts`、`integrations/agent-hub/hermes/__init__.py`；安装器 `integrations/agent-hub/install_presence.py` 当前只处理 Cursor/Pi/Hermes，输出明确写着 DSH 暂无稳定 hook 接缝。DSH 真实接入属于本期范围，任何模拟 fixture 均不能替代 AC-008。
- 固件 / BLE：`src/data.h` `_applyJson()` 解码现有 JSON 字段；`src/main.cpp` 使用 135×240 竖屏、landscape、session/agent chrome 和 approval overlay；`src/ble_bridge.cpp` 是 NUS 传输入口。具体新增 roster packet、大小和字符容量尚未实现/测量。
- 测试：`tools/test_agent_hub.py` 与 `tools/test_provider_quota.py` 是 Python `unittest` 离线风格；`tools/test_serial.py` 与 `tools/test_xfer.py` 会找串口并操作 Stick，禁止列入普通离线门禁。未发现仓库根 pytest/CI/统一测试配置；`platformio.ini` 有固件环境，构建不等于设备功能验证。

## 目标仓库与职责

本切片只涉及当前单仓 `codex-buddy`：桌面 bridge、助手 hook/adapter、Stick 固件和仓内脚本/文档。无其他部署仓或远端系统。DSH 的第三方应用/受支持 plugin API 是外部接缝依赖，不是第二个本仓 repo；由 DSH adapter 实现责任人提供版本、API 合约和可运行测试 profile。

| 区域 | 仓库路径 / owner | 自动化边界 |
|---|---|---|
| Hub / approval / packet | `tools/codex_usage_ble_bridge.py`；bridge 开发 | 标准库单测、异步队列/回执集成测试、packet 合同与隐私断言 |
| Codex plugin / 其他 hooks | `plugins/codex-usage-stick/`、`integrations/agent-hub/`；adapter 开发 | 输入映射、失败回退、安装模板/幂等检查、真实来源 contract tests |
| Stick parser / UI / BLE | `src/data.h`、`src/main.cpp`、`src/ble_bridge.cpp`；固件开发 | host 可跑解析/协议单测若技术接缝可行；PlatformIO 编译 smoke；BLE/屏幕/按键须实体设备 |
| DSH 支持接缝 | 由 DSH adapter 负责人确认的受支持版本/API；产品/技术责任人提供证据 | 合同与真实生命周期集成；不存在受支持接缝时 AC-008 阻断，不能把 mock 通过上报为真实支持 |

## 自动化覆盖区域与层级

此矩阵说明每层的目标和人工保留边界。P0 均要求自动化覆盖安全可模拟的条件；真实设备与来源原生界面仍需要端到端/人工证据。

| 区域 | 关联 TC / AC | 自动化层级与验证目标 | 人工保留 / 证据 |
|---|---|---|---|
| AUTO-AREA-001 会话身份与状态机 | TC-001..009；AC-001..004 | Unit + Hub integration：同助手多会话、事件交错、稳定/运行期 ID、cwd fallback、生命周期、超时和迟到事件 | Stick roster 切换与真实来源 hook 生命周期抽样 |
| AUTO-AREA-002 请求队列与设备授权门 | TC-010..017；AC-005..007 | Unit + asyncio integration：队列顺序、prompt ID 绑定、权限 eligibility、重复/迟到/撤销/断连 fail-closed | 已验证 Codex 原生 hook/app-server → Stick → 原请求端的实体闭环；Pi/Hermes/Cursor/DSH 原生 UI fallback |
| AUTO-AREA-003 DSH 与其它 adapter 合同 | TC-018..019；AC-001、AC-008 | Adapter contract + integration：真实受支持 API 版本、字段映射、start/activity/end 到本机 Hub | 真实 DSH profile 的端到端事件；受支持接缝缺失直接阻断，不以 mock 取代 |
| AUTO-AREA-004 隐私与本机通信 | TC-020..021；AC-009 | Unit / socket integration / security smoke：BLE JSON allowlist、敏感 sentinel 扫描、本地 Unix socket 目的端、无历史持久化 | 目标机器网络出口观察、目录差异和日志抽查，使用合成标记 |
| AUTO-AREA-005 固件兼容和屏幕交互 | TC-022..026；AC-003、AC-005、AC-006、AC-010 | Contract / parser unit（可测试 seam 确认后）、PlatformIO build smoke、packet size stress | 实体 Stick 横/竖屏、BLE NUS、A/B 按键、旧 packet 显示与高并发容量实测 |
| AUTO-AREA-006 额度和既有 Codex 回归 | TC-023..024；AC-004、AC-010 | 现有 quota 与 Agent Hub `unittest` 离线回归、旧 packet fixture contract | 仪表/角色实际渲染和 Codex 原生 fallback 回归 |

## 环境、数据与隔离

- 离线单元与 packet 测试：本机 Python 运行环境；不读取真实用户 `$HOME` 下助手数据、不访问设备。优先用固定时间、合成 session/request ID、临时目录和内存 transport fake；清理测试临时目录。
- Approval socket 集成：通过注入临时 Unix socket 路径与 fake BLE/app-server transport 验证；每条请求使用唯一合成 ID；超时/并发用受控时钟或短可注入 timeout。测试后关闭 socket 并清理文件。
- Adapter contract：Pi/Hermes/Cursor/Codex 使用仓内模板/合成 hook payload；真实插件 contract 需在隔离 profile 和明确授权配置中执行，不能覆写用户全局 hook。DSH 需受支持版本与独立隔离 profile，由其责任人提供；当前安装脚本不是 DSH 支持证据。
- 固件/设备：StickS3 一台、匹配本地 bridge、测试固件和 BLE 配对状态；必须由用户单独确认涉及设备连接/刷写/配对的操作。无测试租户或账号需求；不调用云端服务。
- 隐私 fixture：只用 `/tmp/project-alpha`、`SECRET_TOKEN_SENTINEL` 等合成值；测试报告和日志禁止保存真实 cwd、完整 prompt、token、密钥或原始事件对象。
- 报告与清理：离线测试默认输出 unittest 文本到 stdout；若实现 CI，JUnit/coverage 输出路径必须由项目 owner 确认，当前不假定已有报告目录或上传工件配置。设备视频/截图只在确认无敏感内容后保存到受控测试工件。

## 测试入口、文件规划与本地命令

### 当前存在的离线入口

| 入口 | 已核实内容 | 使用边界 |
|---|---|---|
| `tools/test_agent_hub.py` | Python `unittest`，当前按助手类型测试身份映射、轮播和状态超时 | 新增 session-level roster 行为后在此扩展或拆分模块测试；现有实现仍按助手聚合 |
| `tools/test_provider_quota.py` | Python `unittest`，检查额度映射与 usage packet | 作为额度字段兼容回归，不证明 Stick 渲染 |
| `tools/test_serial.py` | 打开 `/dev/cu.usbserial-*` 并向 Stick 写状态 JSON | 仅明确设备测试，不可放进离线测试命令 |
| `tools/test_xfer.py` | 串口传输角色文件并写入设备文件系统 | 有设备写操作，需单独授权和备份；不可放进普通自动化门禁 |

当前可建议的离线命令（基于现有脚本/import 布局，尚未在本阶段执行；自动化计划不是执行报告）：

```bash
python3 -m unittest tools/test_agent_hub.py tools/test_provider_quota.py
```

当前固件 build smoke 命令来源于 `docs/repo-wiki/development.md` 和 README，而非本轮运行：

```bash
pio run -e m5stack-sticks3
```

该命令只验证编译，不验证 parser 运行时、BLE、安全决定或屏幕状态。仓库未发现根级 CI、pytest 配置或统一全量命令，因此暂无“完整 CI 回归命令”可确认；是否后续添加 CI job、JUnit/coverage 工件由项目维护者另行批准，本计划不擅自新增。

### 建议新增的测试文件（由批准后开发实现）

| 建议文件 | 内容 | 依赖/边界 |
|---|---|---|
| `tools/test_agent_hub.py`（扩展） | 多会话映射、短序号生命周期、cwd 末级值、安全降级、会话级结束与 packet roster | 等待 session roster 实现；单测不得复刻另一套生产逻辑 |
| `tools/test_approval_proxy.py`（新建建议） | request ID 与来源绑定、队列、超时、撤销、重复/迟到决定、断连 fail-closed | 使用 fake BLE 与 fake app-server；不连接真实 Codex 账户 |
| `tools/test_agent_adapters.py`（新建建议） | 五类身份映射、event normalization、adapter 输入/输出合同、安装模板不覆盖未知 hooks | DSH contract 需先确认 API/version；用仓内合成 fixture 做离线检查 |
| `tools/test_packet_privacy.py`（新建建议） | packet 字段 allowlist、完整 cwd/prompt/credential sentinel 不外泄、旧 packet 回归 | 需明确新增 packet schema 后冻结断言 |
| `test/` 固件 parser host tests（路径待固件 owner 决定） | JSON 旧/新 packet、缺字段与边界 parsing | 当前未发现 PlatformIO native test/env；先评估能否复用解析 seam，不在本阶段重构固件以造测试性 |

计划中 TestCase 到测试文件的具体分配须等实际 roster / packet schema 冻结后由开发计划确认；新增单测如项目尚无可用配置，遵照 `$unit-test-init`；生成目标文件单测遵照 `$unit-test-generator`，本计划不重复其职责。

## CI 与运行分层

- **开发本地、每次改动**：`python3 -m unittest tools/test_agent_hub.py tools/test_provider_quota.py`；待新增 approval/adapter/privacy tests 后把它们加入明确命令。要求不依赖 BLE、用户 home、外网或用户助手配置。
- **本地提交 / PR（是否接 CI 待项目维护者确认）**：同一离线 unittest 集 + `pio run -e m5stack-sticks3` build smoke；仓库当前未发现 CI workflow，不假设其存在，也不创建。
- **集成 / release candidate**：bridge 临时 socket + fake BLE/app-server contract 集成；真实 Codex approval 闭环、Pi/Hermes/Cursor adapter event 与 DSH 受支持版本 profile 的隔离接入；外部/本机权限必须显式授权。
- **硬件验收**：StickS3 BLE 加密连接、packet 兼容、会话轮播、approval overlay、A/B 当前 prompt 匹配、断连/恢复、空/unknown/offline、额度仪表和角色动画；高并发 packet 与屏幕容量压测。由设备测试人员执行并记录固件 SHA、bridge 版本、Stick 型号、实际结果、截图/观察证据；不可用 compile 或 mock 替代。
- **禁止默认自动运行**：`tools/test_serial.py`、`tools/test_xfer.py` 与任何配对/上传/刷写命令不加入无交互离线测试入口。

## P0 自动化覆盖与必须人工项

| P0 TC | 自动化与可判定信号 | 必须保留的人工/设备证据或阻断 |
|---|---|---|
| TC-001..004、TC-007 | Hub unit：同助手两个 session、交错事件、session end 仅清对应项；稳定 ID / 运行期 ID / 无关联 fallback | 真实 hook 字段由各 adapter contract 核实；Stick 标签需实测 |
| TC-005..006 | packet allowlist 断言末级项目名 / 未知项目且无完整 cwd | 实际用户 cwd 不进入 fixture 或报告 |
| TC-010..016 | Approval proxy unit/integration：request ID 唯一绑定、非闭环不授权、timeout/cancel/stale/duplicate/断连不 allow | Codex 硬件端到端闭环必须用真实 Stick 与隔离 Codex 权限请求验证；所有其他助手无设备决定 |
| TC-018 | 只有存在受支持 DSH API 时才执行真实 adapter contract/integration；记录版本及 start/activity/end 证据 | 当前代码明确说明 DSH seam 缺失，属于开工实现前最高风险核验；无接缝即 AC-008 阻断，不报告 mock 通过 |
| TC-020..021 | BLE packet JSON allowlist + 敏感 sentinel 扫描 + socket 目标检查 + 文件差异回归 | 本机网络出口/进程/socket/文件行为抽查；避免真实秘密 |

## 报告、证据与失败处理

- **当前实际证据**：源文件和仓库文件清点为只读；本计划未执行测试。历史 Wiki 声称入口存在只作导航，不等于本轮测试通过。
- **自动化运行记录**：实现阶段至少记录命令、cwd、exit code、测试数、失败数和 commit；若后续 CI 被单独批准，再确定 JUnit/coverage artifact 路径。不要把未设置的工件位置写为已有能力。
- **设备证据**：按 TC 编号记录 Stick 型号、固件 revision/hash、bridge revision、助手版本/API、连接/按键步骤、观察到的 UI 与 request ID 决策落点。脱敏掉完整 prompt/cwd/token。
- **失败处理**：任何 P0 错误 allow、跨 request/session 决定或敏感 packet 外泄立即阻止发布；DSH 接缝缺失阻止本切片实现完成，回产品负责人修订范围；硬件断连或设备不可用不降低安全断言，只把设备层记为未执行并阻止相关验收通过。
- **Flake 控制**：异步请求用注入时钟和 fake transport；真实 BLE/原生 assistant 集成在独立隔离 profile 上运行，不并行复用同一 Stick / approval socket；保存只含脱敏 ID 的诊断摘要。

## 自动化实现任务建议

这些是供后续开发计划消费的建议任务，不是已批准开发任务，也没有修改生产代码。

| 编号 | 目标仓库 / 测试入口 | 覆盖 / 验证命令 | 证据 |
|---|---|---|---|
| AUTO-TASK-001 | `codex-buddy` / `tools/test_agent_hub.py` | 新增会话级 roster、身份短标识、cwd 安全值、生命周期回归；`python3 -m unittest tools/test_agent_hub.py` | unittest 输出、session 事件/packet 断言 |
| AUTO-TASK-002 | `codex-buddy` / `tools/test_approval_proxy.py` | 队列、授权门、request ID、timeout/cancel/stale/duplicate/断连；`python3 -m unittest tools/test_approval_proxy.py` | fake BLE/app-server 回执与 pending 队列断言 |
| AUTO-TASK-003 | `codex-buddy` / `tools/test_agent_adapters.py` | Codex/Pi/Hermes/Cursor/DSH event contract 与安装模板安全；`python3 -m unittest tools/test_agent_adapters.py` | 合成 adapter 输入输出；DSH 需另附受支持 API/version 证据 |
| AUTO-TASK-004 | `codex-buddy` / `tools/test_packet_privacy.py` | 新 packet allowlist、敏感字段与旧 packet 兼容；`python3 -m unittest tools/test_packet_privacy.py tools/test_provider_quota.py` | 捕获 JSON、无敏感 sentinel、旧 quota/agent 键断言 |
| AUTO-TASK-005 | `codex-buddy` / `src/data.h` 关联固件 host test 或已有 seam | parser 缺字段/旧新 packet；先由固件 owner 选择可行测试入口 | parser fixture 结果；若无法 host-test，写明受限代码区与设备替代证据 |
| AUTO-TASK-006 | `codex-buddy` / PlatformIO 与 StickS3 手工验收 | `pio run -e m5stack-sticks3`；随后按 TC-022..026 执行实体设备矩阵 | build log + 设备记录；build 不代替硬件结果 |
| AUTO-TASK-007 | DSH adapter owner 提供受支持接口版本与隔离 profile | DSH contract/integration test 真实 start/activity/end 到 Hub/Stick | 官方/受支持接口版本记录 + 真实事件关联证据；缺失即阻断 |

## 未决问题、假设与阻断范围

- **P0 阻断风险：DSH 接缝**。当前仓内 `integrations/agent-hub/install_presence.py` 明确输出 DSH 无稳定 hook surface。责任角色：DSH adapter 技术负责人提供本期受支持 API、版本、安装方式与生命周期证据；影响 `AC-008` / `TC-018` / `AUTO-TASK-007`。这是技术设计与实现前提，但自动化计划仍可描述“接缝具备/缺失”两种判定路径；不得因此宣称已有测试可执行或接入成功。
- **需开发确认：会话字段来源**。各来源能否提供 stable session ID / 临时关联句柄、Cursor hook 是否给 cwd、Codex hook 是否有 session_id，需 adapter owner 对照版本和 payload；影响 `TC-003..006`、`AUTO-TASK-001/003`。测试保留 PRD 降级规则，不臆造字段。
- **需技术测量：BLE roster / pending 容量与 ID 碰撞**。当前 packet 只有 agent index/count，新增 packet schema 未确定；影响 `TC-025..026` 与 `AUTO-TASK-004..006`。开发前确认 schema、上限、短 ID 冲突解决与不丢请求策略。
- **需固件 owner 确认：parser 自动化入口**。当前 `src/data.h` parser 与设备相关类型耦合，未找到已有 host test 配置；影响 `TC-022` / `AUTO-TASK-005`。先评估最小 host seam；如果不可行，不做大重构，保留构建 smoke 与设备实测并明确未自动覆盖。
- **CI 接入未决但不阻断本计划**：仓库未发现 CI workflow；本阶段不新建、不启用。后续由仓库维护者单独决定是否接入 GitHub Actions 和报告 artifact。

上述内容是自动化策略草案，不新增用户业务决策、账号、租户或云端依赖。自动化任务编号供 `development-plan.md` 引用；只有技术方案先确认 DSH/API/packet 接缝与容量后，才能冻结实际路径、测试文件和最终门禁命令。

## 评审要点

请评审自动化层级、P0 fail-closed 验证范围、DSH 无受支持接缝时的阻断处理、是否维持本期不新增 CI，以及真实 Stick/Codex 闭环必须作为手工或隔离集成证据的界限。未决技术项集中于本节；它们不要求放宽已批准的 AC/TC，需由各实现责任人在技术方案阶段提供证据。本阶段只生成策略，不创建测试文件或运行测试。

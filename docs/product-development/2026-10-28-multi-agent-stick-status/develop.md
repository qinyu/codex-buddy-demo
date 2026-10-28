# 开发执行记录：多助手 Stick 状态与确认（进行中）

## 当前进度

按已批准 `development-plan.md` 顺序开始 TASK-000 只读基建审计，再进入业务任务。TASK-000 发现当前仓库已有标准库 `unittest` 测试文件，但没有根级统一 runner、JUnit/coverage 报告配置或活动 Git Hook；仅完成只读现状审计，测试基建准备本身尚未完成。用户已明确豁免本切片内补建统一测试入口/机器可读报告，由用户负责以后补齐；本切片继续沿用现有 `PYTHONPATH=tools python3 -m unittest ...` 命令。TASK-000 保持未完成且带豁免，不安装依赖、不改测试框架、不把测试状态标绿。

TASK-001 的有效 RED 已由用户在仓库根手动确认：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py`，10 个测试中 2 个失败，命中同助手会话合并与 SessionEnd 错误删除，退出码 1。此前 ImportError 不计为 RED。随后实现按 agent+session 分隔 Hub key、精确 SessionEnd 和近期 Codex hook session fallback 抑制。用户随后手动运行同命令，退出码 0，13 个测试通过（`Ran 13 tests ... OK`）。结合已完成的规格符合 review、代码质量 review，TASK-001 关闭。

DSH 接入仍未验证；不启动其 adapter 实现、安装、启用或用户 profile 修改。Stick/BLE/配对/刷写未授权，未执行。

## 任务与证据

| 任务 | 状态 | 本轮动作 / 证据 | 下一步 |
|---|---|---|---|
| TASK-000 | 已豁免 · 未完成 | 用户负责；本切片继续使用既有 unittest 命令，不建设统一入口或机器可读报告 | 后续由用户补齐；不阻断本切片授权范围内的业务测试 |
| TASK-001 | DONE | 用户提供 RED：10 tests / 2 failures；实现 `tools/codex_usage_ble_bridge.py` 与 `tools/test_agent_hub.py`；用户提供 GREEN：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py` 退出码 0，13 tests，OK。主代理复核规格和代码 diff，`git diff --check` 通过 | 按序进入 TASK-002；DSH 仍阻断 |
| TASK-DSH-VERIFY | BLOCKED | 本轮无 DSH 探查、插件运行、配置修改 | 保持暂停，等待经授权的真实接缝核验和产品负责人复核；adapter 实现不排期 |

### TASK-001 RED/GREEN 回执

执行位置：仓库根目录。

```bash
PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py
```

预期信号：测试可导入 `codex_usage_ble_bridge` 并运行到新增断言；`test_two_sessions_from_same_agent_keep_independent_state` 因两个同类型 session 被聚合而失败，`test_session_end_removes_only_matching_same_agent_session` 因结束事件删除了不匹配会话而失败。若仍是 ImportError 或其它错误，不能开始实现，应先报告错误并修正验证入口。

RED 已由用户实际执行并提供：退出码 1，10 个测试中 2 failures；`test_session_end_removes_only_matching_same_agent_session` 断言 `0 != 1`，`test_two_sessions_from_same_agent_keep_independent_state` 会话集合缺少 `cx-01`。这支持原 bug 的预期 RED。GREEN 已由用户执行上述命令，退出码 0：`Ran 13 tests in 0.001s` / `OK`。此前 ImportError 回执因未加载模块而无效，不作为 RED。

## 文件变化与回滚

本任务修改：`tools/codex_usage_ble_bridge.py`、`tools/test_agent_hub.py`。回滚时仅回退本任务上述改动，不碰其它工作区文件。DSH 和设备操作继续排除。

## 未完成验证与风险

- 单测 RED/GREEN：TASK-001 已完成；RED 与 GREEN 均由用户在本机手动执行并提供回执。
- TASK-000 机器可读测试报告与 Hook 质量门：已由用户豁免本切片内的测试基建部分；仍未完成，由用户负责后续补齐，不得标为通过。
- 生产实现、固件构建、真实 DSH 生命周期与实体 Stick E2E：未运行。
- AC-008 仍阻断切片完成；禁止将当前执行状态表述为五助手功能可用。

## TASK-001 GREEN 待验证

实现完成两阶段 review：规格符合 review 对照 AC-001/004、TC-001..004，确认仅在 Hub 内按助手+session 区分状态并按 session 结束；未扩到 packet/短标/cwd/固件/DSH。代码质量 review 检查 diff，`git diff --check -- tools/codex_usage_ble_bridge.py tools/test_agent_hub.py` 通过。用户最新 GREEN 回执为退出码 0、13 tests OK，TASK-001 关闭。

TASK-001 用户 GREEN 回执：

```bash
PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py
```

GREEN 已通过。下一项按计划进入 TASK-002 测试 RED 阶段；在用户手动执行新测试确认有效 RED 前，不修改审批生产代码。DSH 实现、安装和启用继续暂停。

## TASK-002 完成

已按计划进入 Codex 审批队列安全任务，新增 `tools/test_approval_proxy.py`，并在 `CodexApprovalProxy.handle_device_message()` 中加入当前 active prompt ID 检查：只有设备回执 ID 与当前活动请求一致时才消费 pending/发送 JSON-RPC 决定。测试覆盖非队首请求、RPC 只回匹配 ID、cancel 映射、重复/非法决定、hook 超时、proxy 断连、非支持方法及缺少请求 ID。

用户手动运行 `PYTHONPATH=tools python3 -m unittest tools/test_approval_proxy.py`，退出码 0，10 tests / OK；输出包含非法决定诊断 `[approval] unknown decision from StickS3: maybe`。这是当前测试套件通过结果，不是计划要求的新缺失行为 RED；不据此声称新增安全行为已由有效 RED/GREEN 证明。此前 TASK-002 测试/生产改动仍属工作区现状，不回退、不擅自改写。离线测试不替代真实 Codex app-server/Stick E2E。DSH 实现/安装/启用继续暂停。

## TASK-003 RED 阶段（非 DSH adapter 合同）

串行启动 Codex、Pi、Hermes、Cursor 的现有仓内 hook/payload adapter 映射与安装模板安全测试。新增 `tools/test_agent_adapters.py`，覆盖 Codex hook envelope 保留 session/cwd、Pi 生命周期注册与稳定 session/cwd 字段、Hermes 生命周期 session 映射/独立结束，以及 Cursor 安装保留未知 hooks 并刷新旧安装。DSH adapter/安装/启用全部排除，DSH 相关部分继续作为独立阻断项。按真实仓库约束，测试文件写入后交用户手动执行 RED/GREEN，本轮未运行测试或构建。

用户首次运行 `PYTHONPATH=tools python3 -m unittest tools/test_agent_adapters.py` 退出码 1，6 tests 中 1 error：Cursor 安装器测试读取 `entries[1]["command"]` 时因该项为字符串 `unknown-entry` 抛出 `TypeError`。核对 `integrations/agent-hub/install_presence.py` 后确认安装器保留已有 `keep-me` 与 `unknown-entry` 的相对顺序，再追加新 hook；这是测试预期顺序错误，不是生产行为失败。修正断言顺序后，用户重跑同命令，退出码 0，`Ran 6 tests in 0.013s` / `OK`。此结果支持当前离线 fixture 的 Codex/Pi/Hermes/Cursor 合同与安装器断言通过，不证明真实助手运行时接入、设备显示或审批闭环。已完成限定范围的静态复核，TASK-003 关闭；DSH 子范围继续阻断。

## TASK-004 RED 阶段（packet 隐私与旧包兼容）

用户已确认 TASK-003 离线结果并授权继续。依据批准计划，本任务只涵盖 `UsageSnapshot.packet()` 的 BLE 显示字段白名单、敏感 cwd/prompt/credential 不外泄及既有额度/agent 字段兼容；测试运行继续使用当前 Python 标准库 unittest。测试生成前已执行 unit-test-generator 模式 0：本仓现有 unittest suite 可运行且无本任务相关已知失败；目标 `UsageSnapshot.packet()` 是可直接构造的 dataclass 方法，测试隔离仅用合成数据，不需要 mock 或可测试性重构。Python 技术栈参考已读取；由于仓库既有测试以 unittest 为约定，沿用它，不引入 pytest/依赖。

新增 `tools/test_packet_privacy.py`，覆盖 `sessions` display allowlist、合成敏感值不外泄和旧 packet 字段兼容。审查修正包括缺失字段 fallback、严格文本限长、非法页码归零、空 roster 显式输出、同页短标截断碰撞时用稳定 hash 消歧，以及每页最多 8 条的 `sessions_page_index` / `sessions_page_count` 分页合同和第二页选择。最小两会话 packet 估算为 426 UTF-8 bytes；固件 `RX_CAP=2048`，可用 2047 bytes。最大页+完整 usage packet 未量测。TASK-004 仅拥有 Python packet contract；Stick 端还没有翻页命令或 roster UI，故不声称设备列表可浏览。完整设备端交互依赖后续 TASK-005 固件/parser/UI，不擅自扩大本任务文件范围。

初次未配置 `PYTHONPATH` 的命令在 import 阶段失败，非 RED。用户修正后运行测试，退出码 1，16 tests 中 1 error：访问 `packet["sessions"]` 触发 `KeyError`，命中业务缺口，是有效 RED。用户要求修复后，针对规格/质量审查指出的缺失 fallback、截断长度超限、静默截断及页码/类型/短标碰撞边界补了实现和测试。用户现已运行修订后的完整命令，退出码 0，`Ran 23 tests in 0.001s` / `OK`；这是 TASK-004 离线 packet privacy + quota 回归 GREEN。实现符合 Python packet 层范围；设备 UI 翻页依赖后续 TASK-005，不能宣称 Stick 端列表可浏览或容量实测通过。按用户要求本任务完成后停下等审阅，不启动 TASK-005。DSH 接入及相关实现继续暂停。

```bash
PYTHONPATH=tools python3 -m unittest tools/test_packet_privacy.py tools/test_provider_quota.py
```

TASK-000 waiver 按用户授权写入 `.workflow-state.json` 顶层 `waivers[]`，责任人为用户、范围仅本切片；任务保持「已豁免 · 未完成」。DSH 接入仍未验证，相关实现、安装和启用继续不启动。

## TASK-005 已豁免 · 未完成

用户明确授权本切片跳过固件 parser 和界面实现，并由用户负责；不另做 host 测试入口、不改固件、不连接、刷写或操作 Stick。该窄豁免写入 `.workflow-state.json` 顶层 `waivers[]`，任务显示「已豁免 · 未完成」，并不表示测试/设备验收通过。

当前固件 `src/data.h` 不解析 `sessions` / 分页元数据，`src/main.cpp` 无 roster 标签与翻页 UI；这仍是仓库现状。明确未验证项包括固件字段解析、旧/新 packet 共存显示、portrait/landscape 可读性、空/unknown/offline 提示、roster 翻页与物理按键行为、最大 BLE packet 容量及 Stick 设备行为。TASK-005 相关代码和测试入口均未修改；未运行固件 build 或设备验证。

## 开发计划修订：TASK-006 已豁免 · 未完成

用户要求修订计划并明确本次不做固件构建或 Stick 验收。修订后的 `development-plan.md` 已获用户批准，`.workflow-state.json` 记录 `development-plan=Reviewed` 与批准决定。用户同时明确开发阶段保持未完成；`develop=Draft`、`current_stage=develop`。TASK-005（固件 parser/UI）和 TASK-006（固件构建/Stick 验收）均由用户负责、已豁免 · 未完成。新增 TASK-006 窄豁免写入 `.workflow-state.json`；不运行 `pio`、设备脚本，不连接、配对、上传、刷写或操作 Stick。

明确未验证项：固件构建、字段解析、显示、翻页、按键/设备行为、BLE/配对、审批回执、最大 packet 容量以及真实 DSH 接入。DSH 仍为独立阻断项；不得启动 DSH adapter 实现、安装或启用，也不得因本次修订从已批准产品范围中静默删除。当前没有其它已批准且不依赖固件的实现任务可继续；用户要求按该边界做收尾检查，开发阶段仍不标完成。

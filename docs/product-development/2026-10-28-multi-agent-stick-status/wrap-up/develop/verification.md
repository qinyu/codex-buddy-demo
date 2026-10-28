# TASK-001 开发阶段验证记录

- 日期：2026-10-28
- 阶段：develop（Draft；TASK-001 已完成，进入 TASK-002）
- 模式：用户批准的 multi-subagent 串行执行；本轮仅 TASK-001，未派发并行任务。
- 用户提供有效 RED：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py`，退出码 1，10 tests、2 failures。失败分别为 `test_session_end_removes_only_matching_same_agent_session` 的 0 != 1，以及 `test_two_sessions_from_same_agent_keep_independent_state` 缺少 `cx-01`。这支持计划目标行为的预期 RED。更早一次无 `PYTHONPATH` 的 ImportError 不是业务 RED。

## 实现与 Review

- 修改 `tools/codex_usage_ble_bridge.py`：有 session ID 的 roster key 按 agent/session 分离；无 ID 保持 agent key；带 ID 的 SessionEnd 精确移除该 session，无 ID 保持旧助手级删除；近期 Codex hook session 存在时不创建聚合 fallback 条目。
- 修改 `tools/test_agent_hub.py`：加入多 session 状态隔离、精确结束、缺失/空白 ID 兼容、无 ID end 兼容及 fallback 不重复条目测试；轮播既有断言调整为通过 HubAgent.agent_id 选择实体。
- 规格符合 review：通过，范围限于 TASK-001 / AC-001..004 / TC-001..009；未涉及 packet 或 DSH。
- 代码质量 review：静态 diff 检查通过；`git diff --check -- tools/codex_usage_ble_bridge.py tools/test_agent_hub.py` 退出码 0。测试仍未执行，GREEN 未知。

用户提供 GREEN：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py`，退出码 0，`Ran 13 tests in 0.001s` / `OK`。用户本机执行结果作为本轮 GREEN 回执；agent 未重复运行。

## 验证边界与继续条件

| 命令/动作 | 结果 | 证据边界 |
|---|---|---|
| 用户 RED 命令 | 退出码 1；10 tests、2 failures，目标断言失败 | 用户提供的当轮回执；是有效 RED |
| `git diff --check -- tools/codex_usage_ble_bridge.py tools/test_agent_hub.py` | 退出码 0 | 仅空白格式，不验证运行行为 |
| `PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py` | 用户回执：退出码 0，13 tests，OK | 支持 TASK-001 GREEN；不替代硬件/其它任务验证 |
| DSH/plugin、Stick/BLE、固件构建 | not-run | 用户要求 DSH 实现不启动；设备操作未授权 |

TASK-001 RED/GREEN 闭环及两阶段 review 完成，可进入 TASK-002。DSH adapter 实现/安装/启用保持暂停，AC-008 未完成。

## TASK-002 验证回执

- 修改 `tools/codex_usage_ble_bridge.py` 与新增 `tools/test_approval_proxy.py`；当前 active prompt ID 外的决定不再移除 pending 或发送 RPC。
- 用户手动执行 `PYTHONPATH=tools python3 -m unittest tools/test_approval_proxy.py`，退出码 0，10 tests，OK；`unknown decision from StickS3: maybe` 是非法决定断言的预期日志。
- 规格符合与代码质量 review 完成；静态 `git diff --check` 通过。TDD 红态没有补丁前有效回执，用户结果只验证当前实现为绿；此证据缺口作为 concern 保留，未声称已证明 RED。可继续非 DSH 后续任务；真实 Codex app-server/Stick E2E 仍待 TASK-006。
- DSH 实现、安装、启用保持暂停。


TASK-003 已按串行顺序启动，只涵盖 Codex/Pi/Hermes/Cursor 的非 DSH adapter。DSH adapter/安装/启用未启动。

# TASK-002 执行记录（进行中）

- 状态：DONE（用户手动测试回执通过；两阶段 review 完成）。
- 范围：Codex ApprovalProxy 队列、当前 request ID 的绑定、超时/重复/迟到/断连 fail-closed；不扩展其它助手设备授权。
- 文件候选：`tools/codex_usage_ble_bridge.py`、新增 `tools/test_approval_proxy.py`。是否需要改 hook client 需先由现有实现证据决定；避免非必要触碰。
- 用户测试约束：本轮真实工作仓；Skill 生成测试须用户手动运行验证，agent 不自动运行测试/构建。
- DSH：接入未验证，adapter 实现/安装/启用仍禁止；本任务不触碰 DSH。

## 当前交接

新增 `tools/test_approval_proxy.py`，目标命令为 `PYTHONPATH=tools python3 -m unittest tools/test_approval_proxy.py`。`CodexApprovalProxy.handle_device_message()` 增加当前 active prompt ID 精确匹配门。测试涵盖非队首/重复/非法决定、匹配 RPC、取消、超时、断连、不支持方法和缺失请求 ID。用户手动回执：退出码 0，10 tests / OK；`unknown decision ... maybe` 为非法决定测试的预期日志。规格符合 review 核对 TC-010..017、AC-005..007；代码质量 review 静态检查当前 active ID gate 和测试隔离，`git diff --check` 通过。本轮未实测 Codex app-server/Stick E2E。可继续 TASK-003。

## TASK-002 审查摘要

- 规格符合 review：对照 AC-005..007、TC-010..017，当前 active ID gate 阻止非活动/迟到 prompt 的设备回执消费 pending；request RPC 仍使用对应原始 RPC ID；设备批准仅沿现有 Codex proxy。
- 代码质量 review：`handle_device_message` 在移除 pending 前比较 prompt ID 与 `active_prompt_id`；非匹配消息直接返回，不前进队列。测试用 fake BLE / fake process/stdin，不启动外部进程或设备。
- 用户手动验证：`PYTHONPATH=tools python3 -m unittest tools/test_approval_proxy.py`，退出码 0，10 tests / OK。agent 未运行测试。
- TDD 证据 concern：没有补丁前该测试命中目标失败的有效 RED 回执；该 GREEN 只证明现状行为通过，不证明修改前失败。用户要求根据当前结果继续，故保留此证据缺口并继续非 DSH 后续工作。
- 未覆盖：真实 Codex app-server、设备 BLE 回执竞态与实体 Stick；保留到 TASK-006 授权设备验收。

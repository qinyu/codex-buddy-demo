# TASK-003 当前阶段记录

- 范围：仅 Codex、Pi、Hermes、Cursor 仓内 adapter/hook contract 与 Cursor 安装模板保留未知项；DSH 及其 adapter、安装、启用完全排除。
- 测试源：`tools/test_agent_adapters.py`，新增测试覆盖 Codex hook envelope、Pi event registration/session/cwd 结构、Hermes start/end session 映射与 Cursor hook 安装更新/保留未知 hooks。
- 用户回执：首次执行 `PYTHONPATH=tools python3 -m unittest tools/test_agent_adapters.py` 退出码 1，6 tests 中 1 error；第 66 行读取 `entries[1]["command"]` 时因该项为 `unknown-entry` 字符串抛出 TypeError。此为测试顺序预期错误；安装器保留既有项顺序并把新 hook 追加到末尾。修正测试后用户重跑同命令，退出码 0，`Ran 6 tests in 0.013s` / `OK`。本轮未运行测试。限定离线合同测试通过，TASK-003 关闭；不代表真实助手运行时、Stick 显示或审批闭环通过。
- `git diff --check -- tools/test_agent_adapters.py` 通过，仅格式检查，不是行为验证。
- 用户已审阅离线结果并授权继续；随后串行转入 TASK-004，TASK-003 保持已关闭。
- 不得接触 DSH 用户 profile、运行 DSH 插件、实现/安装/启用 DSH adapter。

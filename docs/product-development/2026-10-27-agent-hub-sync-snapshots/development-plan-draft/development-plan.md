# 开发计划：Agent Hub

- **TASK-001**：在 `tools/codex_usage_ble_bridge.py` 中定义 `AgentHub` 与数据结构。
  - 本地验证命令：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py`
- **TASK-002 [CHECKPOINT]**：实现 Hook 事件解析与超时丢弃逻辑，并向人确认协议对齐。
  - 检查点要求：人工核对协议字节封包与测试用例。
- **TASK-003**：在 `tools/test_agent_hub.py` 中扩充自动化单元测试。
  - 本地验证命令：`PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py`

## 对抗审查
- 审查结论：PASS（通过）。任务均绑定测试命令，中途设有明确人工检查点。

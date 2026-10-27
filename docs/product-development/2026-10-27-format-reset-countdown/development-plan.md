# 开发计划

## 任务拆解
- **TASK-001**：在 `tools/codex_usage_ble_bridge.py` 中实现 `format_reset_countdown`。
  - 预计修改：`tools/codex_usage_ble_bridge.py`
  - 本地验证命令：`PYTHONPATH=tools python3 -m unittest tools/test_provider_quota.py`
- **TASK-002**：在 `tools/test_provider_quota.py` 中增加对应单元测试。
  - 预计修改：`tools/test_provider_quota.py`
  - 本地验证命令：`PYTHONPATH=tools python3 -m unittest tools/test_provider_quota.py`

## 验证命令
```bash
PYTHONPATH=tools python3 -m unittest tools/test_provider_quota.py
```

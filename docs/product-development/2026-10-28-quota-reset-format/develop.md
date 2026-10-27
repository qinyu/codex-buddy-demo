# 开发记录：额度重置倒计时格式化

状态：Draft

## 任务与验收

- TASK-001：完成 AC-001、AC-002、AC-003。新增可独立调用的格式化函数，并以单测覆盖区间边界、零值和负值。

## 修改文件

- `tools/codex_usage_ble_bridge.py`：新增 `format_reset_countdown(seconds)`，不接入现有额度流。
- `tools/test_provider_quota.py`：新增表驱动用例，覆盖 172801、86401、86400、7200、3601、3600、61、60、1、0、-1、-60、-61 秒。

## 验证证据

- RED：仓库根目录执行 `python3 tools/test_provider_quota.py`。预期失败：导入尚未实现的 `format_reset_countdown` 时抛出 `ImportError`。
- GREEN：仓库根目录执行 `python3 tools/test_provider_quota.py`。通过，退出码 0；`Ran 15 tests`，`OK`。
- 固件 / 设备验证：未执行。未改固件、未构建或刷写、未连接设备。

## 风险与回滚

- 本次行为只由该格式化函数和单测覆盖；未接入调用方。
- 回滚仅撤销 TASK-001 在上述两个 Python 文件中的改动，不影响其他工作区内容。

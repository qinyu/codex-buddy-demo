# 开发执行：额度重置倒计时格式化

状态：Draft

## TASK / AC 对照

- TASK-001：新增非固件 Python 倒计时格式化 helper 及边界单测；覆盖 AC-001 至 AC-005。

## 修改文件

- `tools/codex_usage_ble_bridge.py`：新增 `format_reset_countdown(seconds_left)`，纯函数按 PRD 格式返回天/小时、小时/分钟、分钟或 `Reset due`。
- `tools/test_provider_quota.py`：新增五项边界测试，覆盖 90061、7261、3599、59 与负数秒数。
- 未修改 `src/`、固件工程配置、设备协议或屏幕接入点。

## 验证证据

- RED：仓库根目录运行 `python3 tools/test_provider_quota.py`。退出码 1；新增测试因 `format_reset_countdown` 尚未在 `codex_usage_ble_bridge` 中定义而 ImportError，确认是预期失败。
- GREEN：仓库根目录运行 `python3 tools/test_provider_quota.py`。退出码 0；19 项测试通过，包含五项新增格式边界测试。
- 差异检查：仓库根目录运行 `git diff --check`。退出码 0，无输出。
- 范围检查：仓库根目录运行 `git status --short` 和 `git diff -- tools/codex_usage_ble_bridge.py tools/test_provider_quota.py`。源码变更仅在这两个计划文件中；未出现 `src/` 或固件工程文件。
- 状态检查：仓库根目录运行 `node .agents/skills/product-workflow-suite/product-workflow/scripts/validate_workflow_state.mjs docs/product-development/2026-10-28-quota-reset-format`，退出码 0，state 校验通过。
- lite 切片结构检查：仓库根目录运行 `node .agents/skills/product-workflow-suite/product-workflow/scripts/validate_lite_slice.mjs docs/product-development/2026-10-28-quota-reset-format`，退出码 0，lite 切片校验通过。

## 结果与风险

- TASK-001 的代码与测试已完成；Python 单元测试通过。函数按要求暂不接入屏幕。
- 未运行固件构建、刷写或设备验证；不对设备表现作结论。
- 风险：该 helper 当前无调用方，是本期已批准范围；屏幕接入如有需要应另行评审。
- 回滚仅涉及上述 Python bridge 与测试文件；固件和协议未变。

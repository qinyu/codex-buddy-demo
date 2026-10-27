# 开发计划：额度重置倒计时格式化

状态：Draft（lite 短计划，不单独请求批准）

## 阅读上下文

本计划拆解已由用户确认的 PRD：`prd.md`（Reviewed，2026-10-28）。用户已确认倒计时格式、负数显示 `Reset due`，并限定本次只增加非固件 Python 函数与测试，不接入屏幕。执行前仍受 PRD `AC-001` 至 `AC-005` 约束。

## 实现上下文

- 模块与 ownership：仓库根目录下的本地 Python bridge `tools/codex_usage_ble_bridge.py`；对应单元测试 `tools/test_provider_quota.py`。
- 已读 repo wiki：`docs/repo-wiki/index.md`、`docs/repo-wiki/development.md`、`docs/repo-wiki/architecture.md`。Wiki 指向上述 bridge 与 unittest 文件；具体路径已回查源码和测试，Wiki 未提供统一测试命令。
- 现有测试入口已实际验证：仓库根目录运行 `python3 tools/test_provider_quota.py` 可执行现有测试（14 项通过）。模块形式 `python3 -m unittest tools.test_provider_quota` 在当前布局下导入失败，故不用该命令。
- 候选文件范围限于上述 bridge 和测试文件。`src/`、固件配置及协议文件均禁止修改。

## 任务

| 任务 | 目标与范围 | 关联验收 | RED / GREEN 与完成证据 | 顺序、风险与回滚 |
|---|---|---|---|---|
| TASK-001 | 在 `tools/test_provider_quota.py` 为格式化 helper 增加边界测试，并在 `tools/codex_usage_ble_bridge.py` 实现纯函数。仅允许修改这两个文件；不接入屏幕或其他调用方。 | AC-001、AC-002、AC-003、AC-004、AC-005 | RED：先写期望格式测试并运行下方测试命令，确认新测试因 helper 尚未实现而失败。GREEN：实现后同一命令全部通过；测试覆盖 90061、7261、3599、59、负数，验证字符串精确匹配。 | 单任务顺序执行，测试先于实现；失败时只回滚本任务的两处变更，不触碰固件与协议。若执行中发现需要接屏幕才能满足目标，停止并回到用户确认，不扩大本任务。 |

文件范围：`tools/codex_usage_ble_bridge.py`、`tools/test_provider_quota.py`。

## 验证命令

- 目的：运行 provider quota 映射及新增格式化 helper 的单元回归。
- 执行位置：仓库根目录。
- 命令：

```bash
python3 tools/test_provider_quota.py
```

- 通过标准：命令退出码为 0，报告所有测试通过，新增边界测试完整覆盖 AC-001 至 AC-004。
- 目的：检查补丁空白错误并核对变更范围。
- 执行位置：仓库根目录。
- 命令：

```bash
git diff --check
git status --short
```

- 通过标准：`git diff --check` 无输出且退出码为 0；变更仅涉及 `tools/codex_usage_ble_bridge.py`、`tools/test_provider_quota.py` 与本切片工作流记录，不出现任何 `src/` 或固件工程文件。

## 风险与回滚

- 风险：函数按剩余秒数格式化但暂不接入调用方，这是用户明确接受的本期边界；不得以验证或演示为由接入屏幕。
- 回滚：仅撤销本任务对 Python bridge 和测试的改动；保留本切片记录，固件不参与回滚。

## 对抗审查

- 人机两句：目标、文件范围、命令、通过标准与禁止接屏幕的边界齐全；没读过对话的实现者可按函数输入输出 AC 和回归命令执行。
- 三轴结论：规格、可判定性、事实三轴无阻断发现。任务映射全部相关 AC；实际测试入口已验证为直接运行脚本，未将失败的模块导入形式当成有效命令。

# 轻量开发计划：额度重置倒计时格式化

状态：Draft（lite 计划不单独请求批准）

## 实现上下文

- PRD 已由用户确认；执行档位为 `lite`，模式为 `one_to_n`。
- `tools/codex_usage_ble_bridge.py` 定义额度重置时间处理；本次只新增可独立调用的剩余秒数格式化函数，不接入调用方。
- `tools/test_provider_quota.py` 使用 Python `unittest` 并导入 bridge 模块；现有验证命令由 PRD 指定。
- repo wiki：`docs/repo-wiki/index.md`、`docs/repo-wiki/development.md`；确认此为桌面 Python bridge 的纯离线验证范围。源码事实以 `tools/codex_usage_ble_bridge.py` 和测试文件为准。

## 任务

| 任务 | 目标与文件范围 | RED / GREEN 与通过证据 | 依赖 / 回滚 |
|---|---|---|---|
| TASK-001（AC-001、AC-002、AC-003） | 仅修改 `tools/codex_usage_ble_bridge.py` 与 `tools/test_provider_quota.py`。先在现有测试类添加格式化函数的用例，运行验证命令确认新测试因函数尚不存在而失败；再实现函数，满足 PRD 确认的天/小时/分钟、`now`、逾期及整秒边界输出。不得改固件或接入 UI、BLE、现有额度数据流。 | RED：`python3 tools/test_provider_quota.py`，预期新增测试因缺少函数而失败。GREEN：同一命令退出码为 0，新增区间、临界值、零值与负值测试通过。 | 单任务顺序执行，无并行修改；若失败，撤销本任务在这两个文件中的改动后复查工作区，不触碰其他文件。 |

## 验证命令

- 目的：运行额度 bridge 单元测试，验证格式化函数所有验收场景。
- 执行位置：仓库根目录。
- 命令：

```bash
python3 tools/test_provider_quota.py
```

- 通过标准：命令退出码为 0，新增用例与既有用例通过。

## 风险与回滚

- 风险：秒数临界值或负数取整方向实现不一致；以 PRD 的具体字符串和边界测试作为裁决依据。
- 回滚：仅回退 `tools/codex_usage_ble_bridge.py`、`tools/test_provider_quota.py` 中 TASK-001 的变更；不得回退其他工作区内容。
- 不构建、不刷写、不连接设备；不改固件。

## 对抗审查

- 人机两句：目标、改动文件、禁止范围和命令明确，可独立执行与判断。
- 规格轴：TASK-001 对应 AC-001 至 AC-003，无额外功能。
- 可判定轴：同一条用户指定命令覆盖 RED 与 GREEN，通过标准明确。
- 事实轴：文件范围与验证入口已从现有源码、测试及 repo wiki 导航回查；没有把 wiki 推断当实现事实。
- 三轴无阻断发现。

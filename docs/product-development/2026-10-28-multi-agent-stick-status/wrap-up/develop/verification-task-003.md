# TASK-003 阶段验证记录

- 用户执行：`PYTHONPATH=tools python3 -m unittest tools/test_agent_adapters.py`，仓库根目录，退出码 0；完整摘要：`Ran 6 tests in 0.013s`、`OK`。
- 首次失败归因：用户前一回执中 6 项有 1 error，`entries[1]["command"]` 把字符串 `unknown-entry` 当字典读取。只读核查 `integrations/agent-hub/install_presence.py` 显示 Cursor 安装逻辑保留未识别项并在末尾追加新 hook；修改仅调整 `tools/test_agent_adapters.py` 顺序断言，没有生产代码修改。
- 覆盖：Cursor 配置更新/保留未知项、Cursor 支持事件安装、Hermes session 生命周期映射、Pi hook 注册及字段静态合同、Codex hook envelope 字段。DSH 完全不在测试及实现范围内。
- 静态范围核查：`git diff --check` 退出码 0；工作区存在任务前已产生的 bridge / hub 测试修改，本任务没有修改这些文件。未运行用户设备配置、DSH 插件、BLE、Stick 或固件。
- 结论：TASK-003 的离线 fixture 范围通过并关闭。测试未证明真实助手进程接入、设备显示或请求审批闭环；DSH 接入仍未验证，AC-008 未完成。
- 阶段边界：按用户要求每阶段停等评审，暂不启动 TASK-004。

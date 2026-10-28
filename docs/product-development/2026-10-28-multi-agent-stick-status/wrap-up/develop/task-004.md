# TASK-004 当前阶段记录

- 范围：`UsageSnapshot.packet()` 的可选 roster display allowlist、敏感字段不外泄和旧 packet 兼容；不实现固件/parser/UI，不触碰 DSH。
- 用户授权：TASK-000 测试基建由用户负责，当前切片继续用既有标准库 unittest 命令；统一入口和机器可读报告延期到本切片之后。TASK-000 保持「已豁免 · 未完成」，state 顶层记录 owner/reason。
- 新测试：`tools/test_packet_privacy.py`；测试 roster 输出只允许 `agent`、`project`、`short_id`、`state`，检查合成 cwd、prompt、credential、raw hook sentinel 不进入序列化 packet；独立检查没有 roster 时保留旧 `state`、agent/index/count、provider/index/count、quota 字段。
- 测试入口用户实际执行：修订后的 `PYTHONPATH=tools python3 -m unittest tools/test_packet_privacy.py tools/test_provider_quota.py`，退出码 0，`Ran 23 tests in 0.001s` / `OK`。之前有效 RED 回执为退出码 1、16 tests 中 1 error，`packet["sessions"]` KeyError；该失败命中当前缺失 roster 的业务行为。
- 审查修订：首次规格/质量审查发现缺失 `project` / `short_id` fallback、字段截断后长度超限，以及超过 8 条 roster 静默丢失后续条目；修复为显式未知标签、agent/project/short_id 最大长度 12/24/12、最多 8 条/页，并在多页 packet 添加页码与总页数，支持指定 `sessions_page_index` 生成后续页。后续静态审查又促使补非法页码防护、空 roster 表示、同页截断短标碰撞时稳定 hash 消歧测试。
- GREEN 状态：用户提供当前修订的 GREEN，23 tests / OK。此证据只覆盖 Python packet/privacy 与 quota 测试，不证明固件解析、Stick 可浏览翻页、最大 BLE 包容量或真实设备接入。
- 容量边界：两会话最小紧凑 JSON 估算 426 bytes；`src/ble_bridge.cpp` `RX_CAP=2048`，可用 2047 bytes。最大 packet 未测；固件/UI尚无分页渲染与操控，本任务只交付 packet 分页元数据合同，不证明设备端可浏览或容量通过，设备端完整可浏览性留待 TASK-005。
- 限制：本轮 agent 未运行用户业务测试，仅记录用户回执；未运行固件构建；未连接 BLE/Stick；未执行 DSH 插件、配置、安装或接入。按用户要求 TASK-004 完成后停下等审阅，不启动 TASK-005。

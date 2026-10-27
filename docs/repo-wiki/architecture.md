# 系统边界与数据流

## 组件

- **固件应用**：`src/main.cpp` 初始化 StickS3 屏幕、设置、宠物与 BLE；主循环轮询串口/BLE 数据，派生状态并绘制仪表、宠物、信息及权限界面。证据：`src/main.cpp:1656-1702`、`src/main.cpp:1729-1742`、`src/main.cpp:2008-2052`。
- **BLE 传输**：`src/ble_bridge.cpp` 提供 Nordic UART Service（NUS），RX 接收 newline-delimited JSON，TX 通过 notifications 回传；连接采用 LE Secure Connections / MITM bonding，并要求加密访问。证据：`src/ble_bridge.cpp:13-15`、`src/ble_bridge.cpp:89-133`、`src/ble_bridge.cpp:162-179`。
- **固件状态解析**：`src/data.h` 将 USB 串口和 BLE 字节行解码为 JSON，更新运行状态、Codex 用量和权限提示；无新数据超过 30 秒时标记未连接。证据：`src/data.h:129-160`、`src/data.h:279-321`、`src/data.h:324-379`。
- **桌面 bridge**：`tools/codex_usage_ble_bridge.py` 使用 `bleak` 连接 NUS，读取本机 Codex 使用/活动数据并写入设备；插件封装的启动脚本位于 `plugins/codex-usage-stick/scripts/`。证据：`tools/codex_usage_ble_bridge.py:1-8`、`tools/codex_usage_ble_bridge.py:31-43`、`plugins/codex-usage-stick/scripts/start_bridge.py:17-43`。
- **Codex 插件**：`plugins/codex-usage-stick/hooks.json` 声明 `SessionStart`、`UserPromptSubmit` 和 `PermissionRequest` hook，由 `hook_entry.py` 记录事件并启动或联系本地 bridge。证据：`plugins/codex-usage-stick/hooks.json`、`plugins/codex-usage-stick/scripts/hook_entry.py:1-5`。
- **角色资源**：角色包通过 `manifest.json` 和 GIF 帧描述各状态；固件从 LittleFS 的 `/characters/<name>/` 加载。证据：`src/character.cpp:161-212`、`README.md`「GIF Character Pack Format」。

## 主要数据流

1. 插件 hook 启动或复用本机 bridge；bridge 通过 BLE NUS 将 JSON 状态、用量和时间数据送到设备。
2. 固件 `ble_bridge.cpp` 将 RX 数据放入环形缓冲区；`data.h` 按换行组包并解析，填充 `TamaState`。
3. `main.cpp` 根据数据派生 `sleep`、`idle`、`busy`、`attention` 等状态，绘制屏幕。权限请求可显示到设备；插件 hook 可经本机 approval socket 等待硬件决策。

第二步和渲染入口由 `src/data.h:342-379`、`src/main.cpp:1729-1742` 支持；approval socket 的客户端路径见 `plugins/codex-usage-stick/scripts/hook_entry.py:84-119`。完整端到端兼容性尚未在本轮设备上验证。

## 协议与安全边界

- NUS Service UUID：`6e400001-b5a3-f393-e0a9-e50e24dcca9e`；RX：`6e400002-b5a3-f393-e0a9-e50e24dcca9e`；TX：`6e400003-b5a3-f393-e0a9-e50e24dcca9e`。
- 消息为 UTF-8 JSON 行，BLE payload 使用 notify/write；设备回执也走 BLE（部分传输回执同时写串口）。证据：`src/ble_bridge.cpp:13-15`、`src/xfer.h:14-22`。
- bridge 会读取本机 Codex usage/session 材料；插件文档称数据不发送到外部服务。代码实际数据源、日志内容和权限请求细节需在相关模块任务中按授权继续确认。
- 角色传输协议含文件名和 LittleFS 写入路径；改动传输功能时应核验路径校验及现有文件覆盖行为。证据：`src/xfer.h:141-197`。

## 未知与边界

未梳理全部 JSON 字段、状态转换和固件 UI 函数；未审计 bridge 对各 Codex/provider 数据源的解析；未核验 Codex 插件市场安装/信任体验与硬件配对。README、插件元数据中存在不同仓库/作者信息，可能是历史发布资料，当前权威归属需维护者确认。

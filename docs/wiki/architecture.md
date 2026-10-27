# Codex Buddy 系统架构概览

## 模块拓扑
1. **StickS3 硬件固件 (src/)**：驱动 LCD 屏、按键监听与 BLE 接收。
2. **桌面 BLE Bridge (tools/codex_usage_ble_bridge.py)**：轮询配额接口，封包广播。
3. **测试防线 (tools/)**：提供行为测试套件。

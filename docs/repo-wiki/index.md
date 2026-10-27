# 仓库导航

Codex Buddy 是 StickS3 / ESP32-S3 桌面伴侣项目。设备固件通过 BLE 接收 Codex 用量与状态，在屏幕上显示用量仪表、宠物动画，并可处理权限请求；桌面端 Codex 插件启动本地 Python BLE bridge。项目同时包含 PlatformIO 固件、插件、角色 GIF 资源和操作文档。

## 关键主题

- [系统边界与数据流](architecture.md)：固件、BLE 协议、桌面 bridge 与 Codex 插件的职责。
- [开发与验证入口](development.md)：构建、刷写、资产上传及现有测试入口。

## 证据入口

- 项目概览与协议示例：[README.md](../../README.md)、[REFERENCE.md](../../REFERENCE.md)
- 操作指南：[docs/USAGE.md](../USAGE.md)
- 固件入口：`src/main.cpp`、`src/data.h`、`src/ble_bridge.cpp`
- 桌面 bridge 与插件：`plugins/codex-usage-stick/`、`tools/codex_usage_ble_bridge.py`
- 构建配置：`platformio.ini`

## 范围与未知

本页基于 2026-10-28 检出的 `main`（`da47804f908313906d6a0a71f7665d9b7f9daa5b`）和少量入口文件建立。没有执行构建、测试或设备验证。完整调用图、各 UI 子模块关系、bridge 的 provider 数据源及自动化覆盖仍未梳理。

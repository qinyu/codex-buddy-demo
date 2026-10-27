# 开发与验证入口

## 固件

- 主要目标为 StickS3 / ESP32-S3；PlatformIO 环境名 `m5stack-sticks3`，另有 `m5stickc-plus`。配置见 `platformio.ini`。
- 文档给出的固件构建命令：`pio run -e m5stack-sticks3`。刷写命令包括 `pio run -e m5stack-sticks3 -t upload` 和 `pio run -e m5stack-sticks3 -t uploadfs`。来源：`README.md`「Build And Flash Firmware」、`docs/USAGE.md`。
- 角色图片来自 `data/characters/`，编入 LittleFS；运行时固件通过 manifest 选取 GIF。上传角色会替换设备上的角色文件，操作前核对目标硬件和资源备份。

## 桌面 bridge 与插件

- Python bridge：`tools/codex_usage_ble_bridge.py`。
- 插件入口：`plugins/codex-usage-stick/scripts/hook_entry.py`、`plugins/codex-usage-stick/scripts/start_bridge.py`。
- Python BLE 依赖为 `bleak`；README/USAGE 提供 `python3 -m pip install bleak`，本轮未安装依赖。
- 插件 hook 信任、Codex 配置、BLE 配对都会影响本机或设备；本轮只做静态只读探查，未操作这些设置。

## 已找到的验证脚本

`tools/test_provider_quota.py`、`tools/test_xfer.py`、`tools/test_serial.py`、`tools/test_agent_hub.py` 是现有测试/设备脚本入口。当前没有确认统一测试命令或 CI 配置；`test_xfer.py` 会探测串口并与 Stick 通信，不应当作纯离线单测。没有运行任何测试或构建。

## 建议后续核验

- 先确认团队采用的 Python 测试命令和 PlatformIO 版本，再运行不依赖硬件的测试。
- 涉及刷写、LittleFS 上传、蓝牙配对、插件启用或 hook 信任时，单独确认设备、账号和本机配置授权。
- 项目状态以当前代码和设备实测为准；README 的已测试清单是项目文档陈述，不是本轮验证结果。

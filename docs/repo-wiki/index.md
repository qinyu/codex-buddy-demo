# Codex Buddy Wiki

## Purpose

Codex Buddy pairs M5Stack StickS3 firmware with a local Codex usage bridge, displaying usage windows and activity states on the device. The project describes itself as a personal fork of Anthropic's `claude-desktop-buddy` reference firmware. [README.md](../../README.md#L1-L14)

## System map

- **Firmware:** `src/main.cpp` initializes the device and BLE server, renders the usage dashboard, and processes device interaction. [src/main.cpp](../../src/main.cpp#L12-L21) [src/main.cpp](../../src/main.cpp#L1656-L1682)
- **BLE protocol:** `src/ble_bridge.cpp` exposes a Nordic UART Service. The desktop bridge writes to RX and receives notifications on TX; the characteristics require encrypted access. [src/ble_bridge.h](../../src/ble_bridge.h#L5-L15) [src/ble_bridge.cpp](../../src/ble_bridge.cpp#L89-L133)
- **Desktop bridge and plugin:** `plugins/codex-usage-stick/` contains the Codex plugin hooks and Python bridge. Hook events start the local bridge; it discovers the Stick and sends compact usage/state data over BLE. [plugins/codex-usage-stick/hooks.json](../../plugins/codex-usage-stick/hooks.json) [plugins/codex-usage-stick/scripts/codex_usage_ble_bridge.py](../../plugins/codex-usage-stick/scripts/codex_usage_ble_bridge.py#L1-L9)
- **Character assets:** the device loads GIF character files from LittleFS at `/characters/`; PlatformIO builds the filesystem image from `data/`. [docs/USAGE.md](../../docs/USAGE.md#L65-L76)

## Build and operation

- Firmware target: `m5stack-sticks3`, configured in `platformio.ini`; the usage guide documents `pio run -e m5stack-sticks3`. [platformio.ini](../../platformio.ini) [docs/USAGE.md](../../docs/USAGE.md#L31-L41)
- Plugin setup and BLE troubleshooting: [docs/USAGE.md](../../docs/USAGE.md).
- Project overview and user-facing behavior: [README.md](../../README.md).

## Boundaries and unknowns

- **Observed design:** the desktop bridge and firmware communicate through BLE; firmware advertises as `Codex-XXXX`. [src/main.cpp](../../src/main.cpp#L12-L21) [docs/USAGE.md](../../docs/USAGE.md#L59-L63)
- **Not verified in this setup:** no firmware build, device flash, Codex plugin execution, or hardware/BLE connection test was run.
- **Documentation discrepancy to review:** `docs/USAGE.md` clone examples refer to `openelab-commits/codex-desktop-buddy`, while this checkout is `qinyu/codex-buddy-demo`. No correction was made as part of this basic Wiki.

## Evidence scope

Read-only inspection for this initial Wiki covered `README.md`, `AGENTS.md`, `platformio.ini`, `docs/USAGE.md`, `src/main.cpp`, `src/ble_bridge.h`, `src/ble_bridge.cpp`, `plugins/codex-usage-stick/hooks.json`, and `plugins/codex-usage-stick/scripts/start_bridge.py` / `codex_usage_ble_bridge.py`. This page is a navigation overview, not a complete architecture analysis.

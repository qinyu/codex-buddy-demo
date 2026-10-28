# 开发执行记录：额度重置倒计时格式化函数

本记录覆盖已批准 PRD 与轻量开发计划中的 `TASK-001`。目标是统一额度重置倒计时文本规则，并把无可用值明确显示为 `NA`。本轮执行方式为单执行者串行；格式函数直接 C++ 测试为主要行为证据。

## TASK-001 / AC-001 至 AC-005

- 修改：`src/main.cpp` 改用共享格式函数；新增 `src/reset_countdown.h` 作为无 Arduino 依赖的纯逻辑测试接缝；新增 `tools/test_reset_countdown.cpp` 覆盖完整/紧凑显示、天/小时/分钟、不足一分钟、到点、负数及不可用值。
- RED 证据：`g++ -std=c++11 -Wall -Wextra -pedantic tools/test_reset_countdown.cpp -o /tmp/test_reset_countdown && /tmp/test_reset_countdown` 在格式实现落地前失败，初次因为共享函数文件不存在；补入实现后，测试继续发现 3600 秒分桶显示为 `60m`，修正为小时格式后通过。

## 验证证据

- 通过：`g++ -std=c++11 -Wall -Wextra -pedantic tools/test_reset_countdown.cpp -o /tmp/test_reset_countdown && /tmp/test_reset_countdown`，退出码 0，C++ 表驱动边界测试通过。
- 通过：`pio run -e m5stack-sticks3`，退出码 0，PlatformIO 显示 `m5stack-sticks3 SUCCESS`；首次运行安装项目声明的 PlatformIO 依赖后完成编译。
- 未通过（既有环境依赖缺失）：`python3 -m unittest discover -s tools -p 'test_*.py'`，发现 24 项，其中 22 项通过，`test_serial` 与 `test_xfer` 导入失败：`ModuleNotFoundError: No module named 'serial'`。本次未安装依赖、未改动环境。
- 未执行：设备烧录与实机屏幕验证；当前没有硬件运行证据。

## 风险与回滚

- 原有小屏倒计时布局空间有限；为紧凑显示保留了无前缀格式，较宽的文本入口保留 `resets in ...` 形式。设备实际可读性尚未实测。
- 回滚范围仅为 `src/main.cpp`、`src/reset_countdown.h` 与 `tools/test_reset_countdown.cpp` 中 `TASK-001` 的变更，不涉及额度数据、BLE 协议、UTC 同步或布局。

## 用户批准

- 当前验证证据尚待用户批准；用户批准前，本切片不标记完成。

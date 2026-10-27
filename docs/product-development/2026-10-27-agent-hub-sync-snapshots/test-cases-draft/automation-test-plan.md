# 自动化测试计划：Agent Hub

## 覆盖范围
- 单元测试覆盖 Agent 注册、轮播、超时剔除和畸形事件。
- API 与 E2E 不适用：本切片只验证本机 Python 状态聚合，不新增 HTTP API 或浏览器流程。

## 验证命令
```bash
PYTHONPATH=tools python3 -m unittest tools/test_agent_hub.py
```

## 硬件边界
BLE 广播、StickS3 显示、声音和按钮回传需要连接目标设备后另行验证；主机测试通过不代替设备验收。

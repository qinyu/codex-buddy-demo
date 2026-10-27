# 技术方案设计：Agent Hub 跨进程与 BLE 广播协议

## 模块架构与数据结构
在 `codex_usage_ble_bridge.py` 中引入 `AgentHub` 聚合类：
```python
class AgentHub:
    def __init__(self, heartbeat_timeout_sec: float = 60.0):
        self.agents: dict[str, AgentPresence] = {}
        self.timeout = heartbeat_timeout_sec

    def ingest_hook_event(self, event: dict) -> None: ...
    def active_agents(self) -> list[AgentPresence]: ...
```

## BLE 数据缝隙协议 (Packet Seam)
将 Agent 数量与焦点状态打包装入广播报文：
- 字节 0~1：Header 标识 (`0xCB`)
- 字节 2：当前焦点 Agent ID 枚举
- 字节 3：当前焦点状态 (0=idle, 1=busy, 2=attn, 3=error)
- 字节 4：活跃 Agent 总数
- 字节 5~8：Primary & Secondary 百分比

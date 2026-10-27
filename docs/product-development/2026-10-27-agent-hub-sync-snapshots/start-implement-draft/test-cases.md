# 测试用例文档：Agent Hub 多智能体行为矩阵

| 用例编号 | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 对应 AC |
|---|---|---|---|---|---|
| **TC-01** | 首个 Agent 注册 | Hub 为空 | 传入 Codex 启动事件 | active_agents 长度为 1，焦点设为 Codex | AC-01 |
| **TC-02** | 多 Agent 正常轮播 | 已有两个活跃 Agent | 轮询调用 tick | 焦点每 5 秒按顺序切换一次 | AC-01 |
| **TC-03** | 心跳超时剔除 | Agent 超过 60s 未上报 | 调用 cleanup_expired | 该 Agent 从活跃列表剔除，计数减 1 | AC-02 |
| **TC-04** | 异常事件防御 | 报文缺失 source 字段 | 传入畸形 JSON | 抛出 ValueError 或记录警告，不崩溃 | AC-01 |

# 外挂：安全扫描

安全扫描是可选能力，源码不在本仓。通用仓构建、测试和发布不读取、不构建客户插件仓。项目若接入，由该项目自行提供 skill 与配置；缺了主流程仍跑。默认 zip 不含，装时另发。

探测：本机已有 `secidea-scan-gate` skill，或项目根有 `.secidea/secidea.json`。未命中：develop 跳过安全检查并写明未扫。

命中：`$product:develop` 编码和单测之后、提 MR 之前跑扫描（skill 先过环境预检与连通检查）；报告 `.secidea/report.json` 进验证证据；门禁 `gate.py` 超阈值 exit 1、报告缺失或坏 JSON exit 2。高危未处理不得标已通过。不挡编码本身。

客户扫描实现不在本仓。探测到 `secidea-scan-gate` 才调用；未探测到则跳过并写明未扫。

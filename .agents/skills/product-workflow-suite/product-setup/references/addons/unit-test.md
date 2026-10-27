# 外挂：单元测试

可外挂。默认 zip 不含 `unit-test-init` / `unit-test-generator`。缺了不挡编码。

## 探测

本机存在上述任一 SKILL.md。未命中：技术方案仍写「基建缺口」，kickoff 记下建议；develop 对新增代码仍要可测，但改用通用 TDD，不点不存在的 skill。

## 挂点

| 阶段 | 命中时 |
|---|---|
| 技术方案 | 缺口章节点名需要 unit-test-init，不代跑 |
| kickoff | 建议先跑 init 脚本交人验证；用户要先写业务则记豁免后继续 |
| develop | 有 generator 才请它写/修单测；没有则按章程增量覆盖 |

初始化只生成脚本/配置，不自动执行构建。

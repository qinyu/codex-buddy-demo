# MODULE-MAP 确认

Explore 出 **draft**。升 SoR 前用 grilling skill；回合格式以该 skill 为准。

## 何时开

`wiki confirm` 前。onboard / scaffold 只写 draft。

## 树的节点

当前轮由 `wiki grill` 给出：

| kind | 决策 |
|---|---|
| `module-or-adapter` | 这块是 module 还是 adapter |
| `domain-name` | 领域名用哪个业务词 |
| `seam-rule` | 对外 seam 叫什么、是否只经它 |
| `out-of-scope` | 什么不算本图 module |

名单未定则本轮只有切法 / 命名 / 范围。路径与调用由 agent 查图。推荐答案来自路径 hint；有图时附 `path:line`。

## 空了之后

`grill_round.ready == true` 且人名非空 → `wiki confirm --by <人>`。确认对话里按 domain-modeling 更新 CONTEXT。ADR 三条门：难逆转、不写会让人奇怪、真有过权衡。

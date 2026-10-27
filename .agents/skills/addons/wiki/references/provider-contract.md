# Provider 契约

调用方先按Wiki入口确定授权与证据类型。普通任务走只读探测和query；refresh是独立获准的写操作。下表保留历史动词与返回字段，不授予自动执行许可。

探测（任一命中即可）：`workflow_policy.code_wiki_provider`；已装 `wiki` skill（内部CLI仍名为 `code-wiki`）；`docs/project-wiki/code-wiki-repos.json`。未命中：Wiki + 源码回查。

`workflow_policy.code_wiki`：`optional`（默认）/ `required` / `not_applicable`。

| 动词 | 完成 |
|---|---|
| ensure（历史兼容） | 可能拉仓、建图或修改配置；仅完整授权的准备任务使用，普通查询以缺口说明代替。`next=ready`/`ask-repos`仍是兼容字段 |
| query | `hits[]` ≤5；`verified` 须 `from_graph=true`；cite 一条 `repo:path:line`；impact 每条带 `repo` |
| refresh | 用户明确授权该仓增量同步后执行；fresh则无需更新，stale本身不是同步许可 |

| 模式 | 做 |
|---|---|
| 未安装 | `optional` 降级；`required` 时 Blocked，把 stderr 安装段交给人 |
| 图过期 | 披露过期；用获准源码补充当前事实。有增量同步许可才refresh |
| `user_declined` | 只答 wiki/词表已有事实 |
| 无仓 | 请求缺失仓库或材料；位置/地址答复不等于clone、安装或建图许可 |
| 跨仓同名 | 每条 hit 带 `repo` |

同一 HEAD + 同一 adapter → cite/impact 对齐 AST。词表 / wiki / 章程进 git。多仓按 git 根建库。

# 可靠取证执行器

本参考用于调用方或用户已明确选定的执行器模式；模式选择以SKILL第2节为准。该模式先确认具体授权清单，再由执行器执行业务 `read`、受限 `search`、公开图 `query`。基础Wiki仍不依赖Python或CodeGraph。query/create/update仍按SKILL第3节交付。

## 请求文件

请求JSON写在**已获授权的 scratch/报告路径**（调用方明确给出的报告目录），不写进工作区。路径未给出就停下问，不自行落盘到工作区。

## 授权来源

授权清单只列用户已确认的具体文件、目录、仓库和查询目的，并附原意依据。执行器核对请求内的声明范围，不验证用户原话，也不拦截其他工具；真实授权仍由调用方与Wiki逐项核对。`workspace`只定位。`unknown`表示获准对象的路径缺失，不是许可；未授予的类别用空列表。路径缺失时只做文件名定位，候选有歧义先问用户；清单未确认前不读业务内容。callers查调用方，impact查变更影响，由Wiki在已获准query内选择，不转给用户选CLI参数。

## 请求 schema

请求只允许 `authorization_confirmed`、`workspace`、`read_scope`、`graph_ops`、`operations` 五个字段；多余字段整批拒绝。

- `authorization_confirmed`：必须为 `true`，表示具体授权清单已经用户确认。缺省、false或其他值整批拒绝，不读取业务内容。
- `workspace`：绝对路径，必须已存在。
- `read_scope.docs` / `read_scope.source`：`[{path, basis}]` 或 `"unknown"`；`path` 相对 workspace，`basis` 为非空授权依据。
- `graph_ops.repos`：`[{repo, basis}]` 或 `"unknown"`；`repo` 为绝对路径。
- `graph_ops.queries`：`[{op, arg, repo, basis}]` 或 `"unknown"`；`op` 只取 `query`/`callers`/`impact`，`repo` 绝对路径，`arg` 非空且不以 `-` 开头。
- `operations`：非空数组，每项只允许：
  - `{"type":"read","path":"<相对路径>"}`（目标必须是文件）
  - `{"type":"search","path":"<相对路径>","query":"<字面量>"}`（目标可以是文件或目录）
  - `{"type":"graph","repo":"<绝对路径>","op":"query|callers|impact","arg":"<非空>"}`

`read`/`search` 的 `path` 必须相对 workspace 且落在某条已授权路径内；`graph` 的 `repo` 必须在 `graph_ops.repos`，且 `(op, arg, repo)` 必须在 `graph_ops.queries`。越出授权、字段多余或路径越界即整批拒绝。

```json
{
  "authorization_confirmed": true,
  "workspace": "/abs/workspace",
  "read_scope": {
    "docs": [{ "path": "docs/repo-wiki", "basis": "用户已授权读取该目录" }],
    "source": []
  },
  "graph_ops": {
    "repos": [{ "repo": "/abs/repo", "basis": "用户已授权该仓库图查询" }],
    "queries": [{ "op": "query", "arg": "某主题如何实现", "repo": "/abs/repo", "basis": "用户已授权该查询" }]
  },
  "operations": [
    { "type": "read", "path": "docs/repo-wiki/index.md" },
    { "type": "search", "path": "docs/repo-wiki", "query": "确认收工" },
    { "type": "graph", "repo": "/abs/repo", "op": "query", "arg": "某主题如何实现" }
  ]
}
```

```bash
node <wiki-skill-dir>/scripts/authorized-operations.mjs <request.json>
```

## 执行语义

- **整批拒绝**：任一操作类型不支持、字段多余、越出授权或路径越界，整批 `rejected`，已获准项也不执行。
- **图不可用即停**：同次请求首个图操作 `graph-unavailable`（status 非 initialized 或退出码非 0）后，剩余图操作直接记 `graph-unavailable`。该仓库本轮图取证停止；不换批次重试绕过，改用已授权源码或报缺口。`build`/`sync` 走既有独立授权路径，不进执行器。
- **收据只覆盖执行器实际执行**：每项操作记录 read 文本、search 的 `scannedFiles`（含零命中文件）与图调用。规则读取、文件名定位、元数据、写入与写后核对仍是通用工具，需要全会话审计；收据不构成全会话隔离证明。

## 汇报

按SKILL第5节回报实际访问，引用收据：search 即使零命中也报 `scannedFiles`、目录数、字节数；截断、错误、不完整（`truncated`/`incomplete`）单独列出。不凭收据就下「无越界」结论；无法完整核对就写「访问核对未完成」。写入、建图/同步和文件名发现沿用各自已授权的直接工具路径。已选此模式的业务读取、内容搜索与图查询若不受支持，报告缺口；改回直接取证须调用方明确选择，不用任意shell静默替代。

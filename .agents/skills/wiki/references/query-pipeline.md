# 查询管线

先按 `code-analysis.md` 确认本次授权与公开查询路径。输入：获准wiki路径 + 业务问题；缺配置或图不可用时报告缺口，普通查询不调用ensure。

```
业务问题 + wiki 路径
  → 词表出 symbols；未命中则当前 agent 收成检索词
  → 按 wiki 的 repo alias 分仓 query
  → hits ≤5：repo + path:line + confidence + wiki_ref；其余 uncovered
```

| confidence | 条件 |
|---|---|
| `verified` | 词表符号，且引擎 `results[]` 有 `file_path`/`line_start` |
| `inferred` | 图有指针但词表未命中 |
| `unknown` | 没有可打开的行号 |

符号名走 `--kind cite` / `impact`。字符串、配置、注释在操作清单内的具体文件逐一rg。跨仓只查已授权仓库，每条带alias；OpenAPI / Project Wiki路由也限获准资料。

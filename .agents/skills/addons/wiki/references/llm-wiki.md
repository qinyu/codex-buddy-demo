# LLM Wiki 成稿

本 skill 维护 `docs/project-wiki/`。地图 / CONTEXT / ADR 是 SoR；`wiki/` 是叙事。

## ingest

confirmed 之后立刻 `$CW wiki ingest`。之后：重要合并、事故、改 seam（seam 变更先 grill / confirm）。

`$CW wiki ingest` 写出 index / overview / modules / seams / how-to-use / log。随后按下面清单补页。

## 页

用词：module / seam。

- 模块页：职责、对外 seam、路径 hint、1～3 个 `path:line`、泄漏（没有则写「未见」）
- 接缝页：约定、现状（ok / leak + 证据）
- index 是目录；how-to-use 保持命令生成的用法页

有图用 `$CW query --kind cite|impact`；无图则读文件并写明未回查图。

## 提问

| 入口 | 读哪 |
|---|---|
| A 架构 | `wiki query` → `index.md` → 模块/接缝页；关系用 `$CW query --kind impact` |
| B 用法 | `how-to-use.md` |

答案引用 wiki 页。可复用的综合回写该页，并记 `wiki/log.md`。调用关系走 `$CW query --kind impact`；符号走 LSP。

## lint

`$CW wiki lint` 只报告。切法变更回 grill / confirm。

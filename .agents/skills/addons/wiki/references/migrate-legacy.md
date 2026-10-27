# 迁移：从 code-review-graph 到 CodeGraph

## 清什么

| 位置 | 内容 |
|---|---|
| 各仓 | `.code-review-graph/`（图 + `meta.json`/`state.json`） |
| 本机全局 | `~/.code-review-graph/registry.json`（目录随之清空则一并删） |
| `.gitignore` | `code-wiki:gitignore` 块里的 `.code-review-graph/` 条目 → 换成 `.codegraph/` |
| AGENTS.md | `code-wiki:knowledge` 段（「用哪套」与命令） → 换成 CodeGraph |

## 留什么

| 位置 | 为什么留 |
|---|---|
| `docs/project-wiki/glossary/<alias>.json` | 业务词表，与引擎无关 |
| `docs/project-wiki/code-wiki-repos.json` | 仓清单，与引擎无关 |
| AGENTS.md 的 `code-wiki:structure` 块 | 源码抽出的模块与惯例，与引擎无关 |

## 顺序

```text
--plan（只出报告）→ 人看 → --yes（清除 + 逐仓 codegraph init）
```

- 未加 `--yes` 时拒绝执行，代码 3
- 幂等：重复跑返回 `alreadyClean`
- 缺引擎：清除已完成即停，`next=install-then-init`，把安装段交给人；已清的不回滚
- 旧 CLI 不自动卸；结尾只提示 `pipx uninstall code-review-graph`

## 为什么不留双份

两套引擎并存会让人不知道该信哪份图，且要同时维护两条适配路径。词表与仓清单本来就跟引擎无关，迁移成本只在重建图，不在重做知识资产。

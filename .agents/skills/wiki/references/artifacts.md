# 产物分流

| 层 | 内容 | git |
|---|---|---|
| 导航 | `docs/project-wiki/`（MODULE-MAP、wiki 活页、glossary）/ `code-wiki-repos.json` / AGENTS marker | 进 |
| 本机缓存 | `.codegraph/`（SQLite + FTS5） | 用 `# code-wiki:gitignore` 块 |
| 评测证据 | `evals/*.json` | 进 |

多仓按 git 根各建一图。

CodeGraph 默认监听文件变更并自动同步，图不需要手动重建；`.codegraph/` 是可重建的缓存，不进 git。

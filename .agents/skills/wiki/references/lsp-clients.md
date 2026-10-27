> 内部CLI维护参考，非Wiki默认流程。仅用户明确授权相应拉仓/安装/LSP动作时使用；材料接入由Setup编排，普通知识任务不进入本页。以下历史命令能力不构成自动执行授权。

# 客户端 × LSP 装法（已核实）

一手依据：OpenCode LSP 文档、Claude Code 插件参考、Serena 客户端文档、Cursor 设置页实测。

| 客户端 | LSP 机制 | 要装什么 | 一键命令 | 验证 |
|---|---|---|---|---|
| **Claude Code** | 官方插件市场**有** LSP 插件；也可自建（plugin.json 的 `lspServers`） | 市场搜 `lsp`，或装 Serena | `serena setup claude-code` | `/mcp` |
| **Codex** | 无内置 LSP，走 MCP | Serena | `serena setup codex` | `/mcp` |
| **OpenCode** | `opencode.json` 的 `lsp` 段 | 多数语言**开箱即有**；C# 需 .NET SDK | 无（改配置） | 编辑器内诊断 |
| **Cursor** | 有 LSP 开关组，但**只能开关内置与限制并发数** | 无需另装；给 skill 用仍走 MCP | 无（设置页） | 设置页可见 |
| **智脉 / Code VT** | 企业客户端；符号查询走 MCP | Serena `--context ide` | 无（手工 MCP） | 客户端能列出 MCP 工具 |

## OpenCode `lsp` 段字段

`disabled`（bool）/ `command`（string[]）/ `extensions`（string[]）/ `env` / `initialization`。

- `"lsp": true` 开全部内置
- `"lsp": {}` 保留内置并叠加自定义
- 自定义示例：`{"lsp": {"custom-lsp": {"command": ["custom-lsp-server","--stdio"], "extensions": [".custom"]}}}`
- **内置已含 C#（`.cs` `.csx`，需 .NET SDK）**、Java、Go、TS/JS 等

## Serena 接入

安装：`uv tool install -p 3.13 serena-agent` → `serena init`。

| 客户端 | 一键 | 手工 |
|---|---|---|
| Claude Code | `serena setup claude-code` | `claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd` |
| Codex | `serena setup codex` | `~/.codex/config.toml` 写 `[mcp_servers.serena]` |
| OpenCode | 无 | 通用 MCP 配置，建议加 `--context ide` |
| Cursor | 无 | 通用 MCP 配置，建议加 `--context ide` |
| 智脉 / Code VT | 无 | 通用 MCP 配置，建议加 `--context ide`。Windows 用 PowerShell |

## 两个必须提前挡掉的困惑

1. **「Cursor 的 LSP 明明开着，跳转也好用，为什么还装 Serena？」**
   那个 LSP 是给 Cursor 自己（编辑器 UI 与它的 AI）用的，**不对外暴露查询接口**，skill 调不到。

2. **「Cursor 已经索引了仓库，为何还要 CodeGraph？」**
   `Index Repositories for Instant Grep` 是 Cursor 自带的本地 Grep 索引（数据全本地），与 CodeGraph 功能重叠但**两套索引互不互通**。

## 现场可用的一点

Cursor 的 `Enable LSPs for Worktrees` **默认关闭** —— agent worktree 内语言服务器默认不开。社区反馈「worktree 里跳转不工作」的成因就是这个（不是 bug）。需要在 worktree 内用符号能力时手动打开。

## Windows 与受限网络

- 现场用 PowerShell，不要把 Git Bash 当运行时。
- Serena 装 Python：`uv tool install -p 3.13.15 serena-agent`（避开损坏的 3.13 软链）。
- `github.com` 超时：jdtls 从 `download.eclipse.org` 拉上游包，lombok 从 `projectlombok.org` 拉，JDK 用 21。不要下 `redhat-developer/vscode-java` 的 VSIX。
- 某一语言服务器起不来时，从 `language_servers` 摘掉它，其余语言继续。

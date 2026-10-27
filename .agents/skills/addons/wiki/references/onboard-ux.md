> 内部CLI维护参考，非Wiki默认流程。仅用户明确授权相应拉仓/安装/LSP动作时使用；材料接入由Setup编排，普通知识任务不进入本页。以下历史命令能力不构成自动执行授权。

# onboard：面向非技术用户的上手

读者可能是产品经理。目标是**他不用敲命令**。

## 分工

| 谁做 | 做什么 |
|---|---|
| skill 替你做 | 检查本机有什么、拉代码、建图、出 LSP 方案、起草模块地图 |
| 必须你做（各一次） | ① HTTPS：本机 Git 已能拉仓即可；SSH 才打开页面粘贴公钥。② 模块地图从 draft 升 confirmed 时给出你的名字 |

## 提问协议

停下来要信息时，只发**一次**结构化提问，每条都带 `purpose`（为什么问、我们会拿它做什么）：

```json
{
  "kind": "ask-repos",
  "purpose": "要在你的工作区建代码知识库，我需要知道把哪些仓库放进来、用什么身份访问。",
  "willDoForYou": ["替你拉代码", "替你建图", "..."],
  "defaultGitBase": "https://git.example.cn",
  "questions": [
    {"id": "git-base", "purpose": "主机定了才知道公钥贴哪", "ask": "代码仓地址是 https://git.example.cn 吗？"},
    {"id": "repos", "purpose": "...", "ask": "一行一个 别名=路径", "example": "backend=group/backend.git"},
    {"id": "auth", "purpose": "...", "ask": "HTTPS 用本机 Git 凭据；SSH 才把公钥贴到 https://git.example.cn/-/user_settings/ssh_keys"}
  ],
  "afterYouAnswer": "我会一次写完清单，然后逐仓拉代码、建图、补章程；失败的仓单独报给你，不重新问一遍。"
}
```

要动用户机器时，改用许可式提问：

```json
{
  "kind": "ask-permission",
  "purpose": "建代码关系图需要一个本地引擎。它不传源码出去，索引存在工作区的 .codegraph/ 里。",
  "ask": "是否允许我执行：`npm i -g @colbymchenry/codegraph`？（Windows 用 PowerShell）",
  "effect": "下载并安装 codegraph 到本机；装完要新开一个终端",
  "undo": "codegraph uninstall"
}
```

## 五件事怎么落地

| 环节 | 谁做 | 做法 |
|---|---|---|
| 1 认证 | HTTPS 优先，用系统凭据管理器 | 只有 SSH 地址才生成密钥并复制公钥。内网没开 22 端口时不要走 SSH |
| 2 平台申请 PAT | HTTPS 私有仓才需要 | `ssh guide` 给 PAT 页与最小权限（`read_repository`）；token 不进文件、命令、日志、remote URL |
| 3 装 LSP | skill 出方案，人要许可 | `lsp plan` → `lsp install --client <c> --yes` → `lsp verify`（三项全过） |
| 4 建 Code Graph | skill 全代做 | `codegraph init`，逐仓。无需人参与 |
| 5 模块地图 | skill 起草 draft | 确认要人名；confirmed 后由本 skill ingest 成 wiki 活页 |

## 两条不要破的边界

- **私钥不出本机**：不回显、不进清单、不进日志、不进评测产物。
- **Token 不明文经手**：让用户在网页里配置一次；我们只给链接和所需权限。

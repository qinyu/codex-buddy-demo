> 内部CLI维护参考，非Wiki默认流程。仅用户明确授权相应拉仓/安装/LSP动作时使用；材料接入由Setup编排，普通知识任务不进入本页。以下历史命令能力不构成自动执行授权。

# Provider clone intake

当空工作区需要从 Codeup、GitLab 或极狐 GitLab 拉取私有仓库时，使用这份最小信息表。完整 clone URL 是事实来源；provider 可以从主机名推断，主机名不明确时再询问。

## 最小信息

| 信息 | Codeup 云效 | GitLab / 极狐 GitLab |
|---|---|---|
| 仓库定位 | 每仓完整 HTTPS 或 SSH clone URL；不要只收项目名 | 每仓完整 HTTPS 或 SSH clone URL，保留 GitLab.com、企业 GitLab 或 `jihulab.com` 主机名 |
| 本地定位 | alias、目标相对目录、可选 branch | alias、目标相对目录、可选 branch |
| HTTPS 认证 | 已配置 Codeup 克隆账号和密码/Token；优先由 credential helper 提供 | 已配置 PAT、项目/群组/部署 Token 或 credential helper；读取代码的权限至少覆盖 `read_repository` 或平台等价权限 |
| SSH 认证 | 已上传公钥且本机可用对应私钥 | 已上传公钥且本机可用对应私钥；同一密钥可覆盖该账号有权限的多个仓库 |
| 安全边界 | 询问认证方式和“是否已准备”，不收集明文 Token | 询问认证方式和“是否已准备”，不收集明文 Token |

## 三问模板

1. **仓库 manifest**：一次列出所有仓库的 `provider/alias=clone-url -> dir @ branch`；branch 可省略，数量不限。
2. **认证准备**：按 provider 分组说明使用 SSH 还是 HTTPS，以及对应 credential helper、SSH key 或 Token 是否已经配置；只收集状态，不收集秘密值。
3. **工作区状态**：工作区根目录、已有 checkout、需要复用的目录；未提供时使用当前工作区并探测已有 Git 根。

## 完成标准

回答后按 `别名=地址` 清单逐仓 clone 或复用已有 checkout，为每个 Git 根单独建图。清单是过程记录（`repos.txt`），拉齐即删，不进项目配置。某仓认证失败时按 alias 报告脱敏错误，认证完成后沿用原清单重试，不重新逐仓收集。

Codeup 的官方入门文档说明支持 HTTPS 和 SSH clone，HTTPS 首次需要配置克隆账号和密码，SSH 需要先配置公钥：[阿里云云效快速创建代码库](https://help.aliyun.com/zh/yunxiao/user-guide/novice-guide-1/)。Codeup 的认证说明补充了 HTTPS 克隆 Token、credential helper 和 SSH 主机配置：[配置 Git 仓库的 SSH 和 HTTPS 两种认证方式](https://help.aliyun.com/zh/yunxiao/user-guide/how-to-set-up-ssh-or-https-repository-authentication)。

Codeup 的 SSH 引导顺序是检查 `id_ed25519`、必要时用 `ssh-keygen -t ed25519` 生成、只复制 `.pub`，再到个人设置 → SSH 公钥上传；多账号或多平台时用 `~/.ssh/config` 选择 `IdentityFile`：[如何配置 SSH 密钥及自定义 SSH 认证密钥的路径](https://help.aliyun.com/zh/yunxiao/user-guide/configure-ssh-key)。

GitLab 官方文档说明支持 SSH/HTTPS clone；启用 2FA 时 HTTPS 使用 Token，读取仓库至少需要 `read_repository` 或等价权限：[Clone a Git repository](https://docs.gitlab.com/topics/git/clone/)。极狐 GitLab 的对应说明同样要求完整实例 URL，并支持 SSH、公钥和 HTTPS Token：[克隆 Git 仓库至本地计算机](https://docs.gitlab.cn/docs/jh/topics/git/clone/)。

GitLab 的 SSH 引导顺序同样是检查现有 Key、生成 ED25519、加入 ssh-agent、上传公钥到个人资料 → Access → SSH keys，再验证连接：[Use SSH keys with GitLab](https://docs.gitlab.com/user/ssh/)。

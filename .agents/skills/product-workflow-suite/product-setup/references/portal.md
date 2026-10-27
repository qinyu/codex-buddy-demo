# 软件门户：Limix CLI（规格 Spec）

本参考是门户对接协议的现有兼容载体，暂留原路径；Setup和阶段只交接本地事实与接入选择。固定ECC源码与Node TAP产物的无PW隔离接入已验证，不代表真实门户或全部第三方流程兼容。

## 接入合同

维护者的本地接入入口是 `scripts/portal-connection.mjs` 导出的 `connectPortalSource({mode, artifact, transport})`，不是阶段骨干依赖或新增安装包。来源适配器先抽出产物事实：PW用portal-source-adapter，ECC用external-workflow-adapter，Node TAP用node-test-source-adapter；各自只解释自身来源，不改来源文件。

传输方提供 `read()` 返回 `{status, revision, artifact}`、`conditionalWrite: true` 和 `write(artifact, expectedRevision)`。认证、CLI/API映射由传输方维护。缺版本或条件写能力时返回unsafe-write且零写入；竞态返回409/412；独立回读一致才synced。重复上报先读到同内容，返回duplicate且零写入。写入结果未知或回读失败不盲目重发，再次调用先读远端。off不读取传输对象。

旧retryPortalSync名称保留，通过transport交给同一入口；仅传send/readRemote或recoverPortalSync的旧write回调会拒绝不安全写入。真实CLI是否支持上述条件写合同须先查能力，未证实就只报告未同步，不拿本地文件传输替身宣称真实服务端安全。

## 接入与刷新

先确认要使用门户，再运行 `command -v limix` / `limix --version`。用户选择不接入时返回 `portal_sync=off`，零CLI调用，不创建项目门户说明或sidecar；已有绑定记录保留。

用户选择接入后，第一问是门户基址。推荐由项目确认的完整 HTTPS origin，也可选测试站 `https://test.limixai.com`、正式站 `https://www.limixai.com`。默认值不是已确认值，须用户明确确认；确认前不写入基址、不打开安装页、不初始化或绑定。写入时去掉末尾斜杠，每轮只问一个决策。

确认基址后检测CLI。缺CLI时征求安装同意，给人 `{门户}/portals/software/setup`，让用户贴回该实例「发给 AI 的安装提示词」；不编替代安装脚本。用户放弃接入则返回off。用户仍选择接入但CLI暂不可用时返回bound_project及未同步，不阻断本地初始化。

接入选择为bound_project时，将本参考写入项目 `docs/product-workflow/portal.md`，填入已确认origin并记录实际CLI版本。CLI可用时按(a)(b)检查能力和绑定；缺能力按「检测与安装」升级复验。切片尚未确定时只做项目接入，不猜规格目录。

刷新从off改为bound_project时，先恢复项目说明和绑定，再按(d)核对三方事实；冲突未裁决不覆盖。从 `bound_project` 改为 `off` 后不再调用CLI，已有 `.limix-artifacts.json` / `.product-workflow-portal.json` 留盘；再次接入时询问是否复用原规格短号。本地Reviewed、开工和完成事实不因接入切换而变化。

对调用方分别返回接入选择、实际同步回执和门户批准事实；未确认、离线或失败均记未同步，本地继续。下面的停止条件只停止门户操作，不停止本地阶段。

本项目门户：Setup 时用户确认的 origin，写在下面这一行。推荐由项目确认的完整 HTTPS origin，但必须用户确认后才写入；未确认时保持占位符。阶段 skill 只读这一行。写入时不要末尾 `/`。

本项目门户：`<用户确认后再写入 https://…>`

下文 `{门户}` 一律等于这一行。没有这一行、或还是占位符：停下来问用户，不打开相对路径、不 init、不绑定。

本仓库用 Limix CLI 做就绪检查、项目绑定、规格绑定和交付同步。命令以本机帮助和实际能力为准，不凭版本号放行。当前须具备 `project link/sync`、`harness doctor`、`spec get/status/update/progress`；只做 Setup 时先检查项目和 Harness 命令，切片同步前再检查规格命令。旧 `requirement`、`workflow`、顶级 `onboard` 不是替代入口。

项目配置 `portal_sync` 为 `bound_project` 时，门户对接层按下面链路消费交接。为 `off` 时不执行门户链路，工作流只维护本地制品账。

## 交付轨道

Setup 选定，阶段 skill 只读配置。

| 用户怎么管交付件 | 配置 | 开工核对 |
|---|---|---|
| 不选门户 | `portal_sync=off` | 阶段审批；有 `.git` 则查本地提交。不跑 `limix`，不写 `.limix-artifacts.json` / `.product-workflow-portal.json` |
| 只软件门户 | `portal_sync=bound_project`，工作区没有 `.git` | 开工后自动同步一次；未同步只报告，本地继续 |
| 代码仓 + 门户 | `portal_sync=bound_project`，切片在 git 里 | 本地提交硬拦；开工后自动同步一次；未同步只报告，本地继续 |

`off` 的完成标准：本切片没有新建门户状态文件，对话里没有 `limix spec`。开工时间写在套件开工记录里。

## 检测与安装

```bash
command -v limix
limix --version
```

没有二进制：给人已确认门户的 `{门户}/portals/software/setup`；让用户从该实例完成首次安装，token 不写进仓库。未装好不得同步。

已装但缺所需命令，或服务端**明确**报告客户端协议不兼容：暂停本次同步，保留原稿和绑定。已初始化的用户先说明 `limix update` 会分别检查 CLI 和当前项目 Suite；征得用户同意后在终端运行。非交互环境须经同意才用 `--yes`。默认发布源来自本机 `limix init` 配置的门户；仅显式设置 `LIMIX_RELEASE_BASE` 才走企业镜像。不要因服务端刚部署或普通网络/鉴权错误臆断要升级。

升级后由新进程检查 `limix --version`、缺失命令和原失败操作。若输出「CLI 版本检查失败（不影响 Suite 更新）」、用户取消替换或只有 Suite 更新成功，**客户端未升级**；即使命令退出码为零也不宣称兼容。发布源不可用时给出已确认实例的安装或支持渠道，不推荐未验证的公共域名。Windows 原生终端使用 PowerShell；Git Bash 不是 WSL。

鉴权用 `limix_` 开头的 API Token；密码登录的 JWT 会被拒。联调工作区要在 Limix monorepo **之外** `git init`，否则会解析到仓库根绑定，绑错 `.limix/project.json`。

## 链路

当前目录默认就是目标。规格绑定和提交必须在**当前切片目录**里跑，或把切片路径当作位置参数。不要对仓库根或 `docs/product-development/` 父目录跑 `spec update` / `spec progress`。

### (a) 就绪检查

```bash
limix harness doctor
```

体检当前工作区；`--format json` 查看 CLI 合成的 `harness.report.v1`。`--fix` 只补安全骨架，不启动 AI 或外部工具。**它不创建项目、不写绑定、也不上传**；要把主报告上报门户用 `limix project sync`。CLI doctor 没有可摄入的单项报告时可显示「未检查」；若用户另有外部结果参考，应与 CLI 状态分开说明。两者均不代表失败或通过；单项评级不直接决定等级或本工作流的开工门禁。真实外部工具的报告格式和旧切片过渡规则见下文「Harness 单项报告」。别和顶层 `limix doctor` 混淆。

### (b) 项目绑定

```bash
limix project link <项目 key 或名称> [workspace]
```

一次即可，绑在放切片的工作区 `.limix/project.json`，不是 frontend/backend 某一个 git 根。不传 key 时交互终端会弹出项目列表；也可把切片路径当 `[workspace]` 传。多个工作区、id 不同时问用户，不要猜，不要传原始 `project-id` 长串。非交互环境要覆盖既有关联才用 `--force`。没有 `project status` 命令，要看绑定就读 `.limix/project.json`。

主报告要上报门户用 `limix project sync`；它不代替绑定，不直接上传单项报告 JSON。

### Harness 单项报告与 Better Harness

`.limix/harness/reports/<report-id>.json` 是外部工具的单项输入，不是 CLI 主报告。仅在工具实际执行并有可脱敏的结论时才准备；Better Harness 只有用户显式调用才运行，不由 Setup 偷跑。每项一份，`reportId` 与文件名一致，`tool.id/name` 写实际来源；状态仅 `pass` / `fail` / `skipped` / `not_applicable`。`fail` 要有事实证据与下一步，不写 `level`、`gates` 或整体门禁，不把缺报告伪装成通过。最终字段以 CLI 仓 `schemas/harness-report.v1.json` 为准。

CLI 可摄入的 Harness 单项报告按**检查当时**的目标标识做新鲜度校验，口径三档：① Git 仓以 **commit** 为准——报告记录的 commit 等于当前 HEAD，即算「已检查」；digest 类字段（workspaceDigest/contentDigest）可选，报告里带了就强校验，与当前工作区不一致仍判过期。② HEAD 变化（新提交）后旧报告过期：CLI 的过期说明保留旧 commit 与检查时间，旧结论不沿用。③ 普通目录不绑定目标标识，走下文「外部结果参考」，CLI 给出指引「请将工作区纳入 git 后重跑，或按外部结果参考呈现」。Git 仓报告没有 digest 时，CLI 在证据里标注「内容未校验」，不因此判失败。当前 CLI 只有内部摘要实现，没有对工作流公开的取摘要命令；不需要也不得凭 HEAD、从源码/测试推导或复刻私有算法，更不能自造哈希来补字段。

区分「CLI 报告」与「外部结果参考」：如果用户或已实际运行的工具提供了可脱敏报告，先如实保留来源工具、报告中的目标标识、时间、状态和证据。若当前 CLI 有公开、文档化的报告摄入/转换入口，按该入口提交原报告，由 CLI 负责 schema 转换和快照捕获；说明 CLI 捕获/校验的是目标身份与时效，不是替外部工具背书。若没有这样的入口，仍可按原文汇总为“外部结果参考：未由 CLI 校验目标快照/时效，不是 Harness CLI 单项报告，不代表平台背书或工作流门禁”。缺少快照字段不阻断参考汇总；只转述来源材料实际包含的信息，缺项标“未提供”，不推断补齐。参考汇总不写入 `.limix/harness/reports/`，也不冒充 CLI 单项报告交给 `limix project sync`；但不得因此阻断其他工作。用户/工具没有提供真实报告或检查事实时，才将该检查标“尚未检查”。

任何情况下都不读、推导或复刻 CLI 私有摘要算法，不手工补造 schema 字段，不编造工具执行、状态、目标、时间或摘要。没有公开支持的 CLI 摄入/快照能力时，不自行造 CLI 报告；保留外部结果参考并说明限制。CLI 验出目标过期时不沿用旧结论。**门户呈现口径**：过期说明写在该检查项的 evidence；problem 只展示 CLI 显式上报的值，CLI 不为过期自造 problem；latest 清单仅对 fail 且 problem 非空的检查项显示问题。同名旧报告不擅自覆盖；旧 `.limix/readiness-skill.json` 不转换成单项报告也不自动删除。CLI 当前对**合法**的 `limix.readiness.skill-output.v1` 两条评审切片仍有过渡摄入，对非法旧文件仅警告；因此不能把所有同名文件一概称为已废弃。单项 JSON 由 CLI 读取合成；需要上传时仍走 `project sync`，不直接调接口。

### (c) 规格绑定

一次绑定 = 一个切片目录 = 一条 Spec。先进入当前切片，或把切片路径当作位置参数：

```bash
limix spec create "<本切片标题>" <当前切片>
limix spec bind <规格短号或标题> <当前切片>
limix spec status <当前切片>
```

已有绑定就沿用（看 `spec status`）。要换规格必须用户明确说，再 `bind`。不要把 A 切片的 `.limix-artifacts.json` 拷到 B。无参 `bind` 只在交互终端弹列表。

当前切片的认法见公共契约 § 认切片（当前工作流目录）：用户路径 → 当前目录是切片 → 恰好一个 → 列出问用户；命中就停。门户绑定同样先按该节钉切片，再 `bind` / `status`。

### (d) 取回基线、裁决差异、提交整包

阶段写成 Draft 或 Reviewed **不是**自动上传。绑了门户时有两类同步：

1. **开工硬卡通过后自动启动一次**（见公共契约 § 开工前交付物核对），不另问是否开始；遇差异、缺原稿或不能裁决时停住，不为完成同步而覆盖任一边。
2. **用户主动要求同步**：同样先取回并展示差异，处理完再提交。开工后默认不传，除非用户再次要求。

步骤（对人只说人话；用户要自己运行或需排障时再给命令）：

1. 认切片、核对项目与规格短号。无规格时只在用户确认新建或选已有后 `spec create` / `spec bind`，不静默再造一条。
2. **先**用 `limix spec status --json <当前切片>` 查看本地、已有基线、门户三方事实和 `nextActions`，把差异展示给用户；不要先运行 `get` 抹掉旧基线。首次没有基线时，`limix spec get <当前切片>` 取门户当前整套到 `.limix/projects/<项目短号>/<规格短号>/baseline/`，随后重看 `status`。基线只用于对比，不是可编辑原稿；取回失败不提交。门户保存当前共享整套及版本、草稿/正式、审核与历史，以门户为准。
3. 向用户说明：「下面是本地原稿和门户当前整套的对比。」先核对原稿齐全；门户有、本地缺失的文件若不恢复到原稿，将退出当前整套，历史仍保留。内容、修订或状态不同，逐文件核对并决定原稿保留哪边以及是否正式；可由 AI 提出有证据的建议，但不能靠“本会话摸过”或文件时间自动选边。需人决定时停下，尤其不能默默删除门户文件。只修改本地原稿，不写基线。正文变更后旧正式状态与审核不自动沿用；完整规则以本机 `limix spec --help` 为准。
4. 原稿及状态处理完后复看 `status`；若门户在裁决后又有新差异，重新裁决，但**不要重新 get 刷掉旧基线**。用 `limix spec update <当前切片>` 提交**完整当前整套**。绑定声明的原稿缺失或不可读时 CLI 不发请求。若 CLI 提示本地 Reviewed 是可随整套标为正式的候选，先请用户明确确认；只有确认后才用 `--formalize`，否则停住，不把 Reviewed 当门户定稿。成功后按 CLI 回执说「已提交，门户状态以页面为准」，给人**当前那一个**查看链接。
5. 若返回整包版本冲突（409）：说「门户已更新，这次提交没有生效。」先用 `spec status --json` 展示原稿、旧基线、门户最新整套的差异；重新裁决全部差异，确认本地原稿齐全后再 `spec get` 刷新基线、复看 `status`、提交。不能先 get 清除用于裁决的旧基线；失败原因参见 `limix spec update --help`。网络、鉴权或本地文件错误按实际原因说明，不能统称门户已更新；不盲目重放非幂等写入。`spec download --out` 仅用于用户明确要求单独导出，不能代替 get 基线。

| 何时 | 打开哪里 | 路径 |
|---|---|---|
| 上传后去看、定稿、确认开工 | 交付物 | `{门户}/portals/software/projects/{projectId}/workspace?tab=artifacts` |
| 线上有新文件、看规格正文 | 规格详情 | `{门户}/portals/software/projects/{projectId}/specs/{specId}` |
| 看看板 | 研发流程 | `{门户}/portals/software/projects/{projectId}/workspace?tab=development-flow` |
| 本机没装 CLI | 安装页 | `{门户}/portals/software/setup` |

`{门户}` 用当前绑定站点。一次回复只给当前那一个。定稿和确认开工都在交付物页上点。**Skill 不调 formal / kickoff API**。不给代码仓、MR、提交页链接。

给用户的常规回复不含 `limix` 或 shell，除非没装 CLI、鉴权失败、客户端需升级、或用户要自己跑。

跑之前心里对齐三行：切片路径、项目短号、规格短号或标题。对不上就停。

### (e) 编码中上报任务态

编码阶段把任务进度报进门户开发看板，走 `spec progress`，**不**经 snapshot，也不会因此把产物打回草稿。

本地总文件：`.limix/projects/<项目短号>/<规格短号>/progress.json`，**分节**保存 `implement`、`plan`、`kickoff`：

```json
{
  "implement": {
    "reportId": "run-2026-09-30-1",
    "tasks": [
      { "key": "TASK-1", "title": "实现结算按钮", "status": "in_progress", "commitShas": [] }
    ],
    "commits": []
  },
  "plan": {},
  "kickoff": {}
}
```

- `implement` 是唯一上报节。`plan`、`kickoff` 从 `.workflow-state.json` **只读投影**，不提交门户：`plan` 只取 `stages.plan`、`kickoff` 只取 `stages.kickoff`；有值写 `{ "status": "<原样阶段状态>" }`，缺 state 或缺对应阶段值写 `{}`；不带 `at`、产物指针、任务列表或整个 `stages`，不归一化状态值。缺 state 不阻止 `implement` 上报。
- 上报时从 `implement` 提取一份**临时扁平报告**（顶层只含 `reportId`、`tasks`、`commits`）：另存为同目录 `progress.report.json`（已在 `.limix/` 忽略范围内），然后：

```bash
limix spec progress --from-file .limix/projects/<项目短号>/<规格短号>/progress.report.json
```

`--from-file` 只认扁平结构，直接传总文件会被拒。上报后临时文件可留可删；总文件才是唯一本地记录，扁平报告不回写、不另存副本。
- 读回核对：每次上报后，或怀疑门户已有不同内容时，跑：

```bash
limix spec progress-read --from-file .limix/projects/<项目短号>/<规格短号>/progress.json
```

它只读对比 `implement` 与门户最新报告：内容不同就**停止**，看差异（本地/门户双边对照），任一边都不覆盖；一致才继续后续步骤。

| 任务 `status` | 人话 |
|---|---|
| `pending` | 待开始 |
| `in_progress` | 编码中 |
| `blocked` | 阻塞 |
| `done` | 已完成 |
| `cancelled` | 已取消 |
| `unknown` | 状态未知 |

- 只收这六态。`doing` 是 Spec 生命周期专用，CLI 本地枚举校验就报「开发进度 JSON 不合法」拒收（exit=2，不发包）；`todo` / `open` / `completed` / `canceled` 也不接受。
- 任务完成必须显式报 `done`；提交数、构建绿**不**推导完成；未上报或零任务也不等于完成，不要用「无提交≈待开始、绿构建≈已完成」自动改任务态。
- **工作流完成但没有合格 commit 时：progress 上报 `blocked`，不报 `done`；`.workflow-state.json` 的工作流状态不回改。**证据缺失用 `blocked` 表达，完成与否仍以显式声明为准。
- 一个任务允许多条 commit，全部列入 `implement.commits[]` 并在该任务 `commitShas[]` 引用；带 `commits[]` 时：`commitSha` 要是 40 或 64 位十六进制；`taskKeys` 必须指向本报告里已有的 `tasks[].key`；`repoId` 用**门户项目里登记的仓库 id**（门户仓库列表 / `GET /software-portal/projects/:id/repos` 返回的 `id`，不是仓库 URL——本地 `.limix/project.json` 只存 URL，要用 URL 对上门户登记再取 id，对不上会被拒 `development_repository_not_in_project`）。
- 只写合同里的字段：上报 payload 服务端是 strict 校验，多带一个字段（如 `reportedAt`）就 400 `development_report_invalid`。
- 每次上报内容有变化必须换**新 `reportId`**；同 `reportId` 内容不同，服务端 409 拒收。
- 上报节奏按用户知悉的节奏来，别静默狂刷。Token 需要 `cli:workflow:run`（与规格创建/提交同族）。

### (f) 切片收工

只在 `$product:wrap-up` 的「切片实现收尾」分支走。阶段评审收尾不走这里。和开工对称：本地记账，网上请人点「确认收工」。给人交付物页链接；**Skill 不调 complete API**（同开工不调 kickoff）。

**收工核对**（同 `product-wrap-up` skill 收工清单 E 条，不重复字段说明）：目标任务为 `done`、已有合格 commit、已有本轮验证证据、计划文件范围无未提交改动。**任一项缺失即停：不写 `slice_wrap_up`、不上报 `done`，把缺项报给用户。**

核对全部通过后：

1. `bound_project`：先按 §(e) 把目标任务报 `done`（字段与命令以 §(e) 为准），再写 `.workflow-state.json` 顶层 `slice_wrap_up`：`{ "at": "<ISO-8601>", "portal_sync": "off"|"bound_project" }`。给人**当前那一个**交付物页链接（见 §(d) 表「上传后去看」那一行），请每位参与人点「确认收工」。全员点过，规格才变成已完成。
2. `off`：不调 `limix`；核对通过后只写 `slice_wrap_up`。

完成标准：核对四项全过且 `slice_wrap_up` 已写入。门户规格是否已完成，看网上状态，不看这一笔。

## 上传哪些文件

对人说话用磁盘文件名（`prd.md`、`clarify.md`）。门户存储名是单单词 key（0.8 硬切后无长名）。CLI 按文件名识别产物（会递归进切片的子目录，点目录跳过；不读 `.gitignore`，不进 `.review-board/`）。有文件才进 snapshot；空文件当缺失。

| 切片根文件 | 门户 key | 说明 |
|---|---|---|
| `prd.md`（或 `spec.md`） | `spec` | 规格文档；必审 |
| `development-plan.md`（或 `plan.md` 等） | `plan` | 开发计划；全局必审底线 |
| `clarify.md` | `intent` | 有则传 |
| `prototype.html` / `design-review.md` | `prototype` | 有意同 key，先扫到谁用谁 |
| `technical-solution.md` | `architecture` | 有则传；对人说「架构方案」。**不要**报 `design` |
| `api-contract.md` | `api` | 有则传；不要和「架构方案」合成一个展示名 |
| `test-cases.md` | `test` | 有则传 |
| `review-board.md` | `review` | 套件几乎不写 |

必审 = `spec` + `plan`（套件 `required` 也始终含 `plan`）。缺这两份时不要声称已满足开工条件；门户确认开工仍要求必审均正式。

### 补充（有则传，没有不要造空壳）

| 文件 | 套件口径 |
|---|---|
| `clarify.md` | full 常有；lite 标 N/A 则没有。原稿缺失先按 §(d) 核对 |
| `technical-solution.md` | 有则传，门户 key `architecture` |
| `test-cases.md` | 有则传 |
| `prototype.html` | 有 HTML 原型才有 |
| `design-review.md` | 套件几乎不写这份；写了进门户 key 也是 `prototype` |

缺件不加 `--force`。

### 不要上传（即使文件在切片根）

| 文件 | 原因 |
|---|---|
| `index.html` | 审查板 HTML。无论在切片根还是 `.review-board/`，都不是门户交付件 |
| `.review-board/` | 本地看板壳、历史、脚本 |
| `.workflow-state.json` | 本地状态 |
| `.product-workflow-config.json` | 套件策略，不是产物清单；CLI 不读它决定传什么 |
| 生成器脚本 | 不是产物 |

审查板只写 `.review-board/index.html`。生成器刷新看板时，若切片根还留着旧 `index.html` / `review-board.js`，会迁到 `.review-board/legacy/`（与 `migrate_suite.mjs` 同一口径）。不要为了迁就 CLI 把看板再拷回切片根。

### HTML 预览

只认切片根的 `prototype.html`。`text/html` **不把正文塞进 JSON**。snapshot 只带 `contentType`、`contentHash`、`byteSize` 和从 `<h1>` 抽出的标题。门户用 hash 对预览，不靠内联 HTML。

审查板在 `.review-board/index.html`，留给本地打开。不是 `prototype.html` 的替代品。

### 现行 CLI 不会扫到（有也不要改名硬塞）

`project-wiki.md`、`automation-test-plan.md`、`start-implement.md`、`develop.md`、`stitch-prototype.md`。这些继续留在 git / 本地看板。缺它们不叫少传；改名去迁就 CLI 才叫多造文件。

`api-contract.md` 与 `technical-solution.md` 是两把独立 key（`api` / `architecture`），各传各的；正文别互相复制。

线上比本机新、两边都改过或状态不同：走 §(d) 展示三方事实并逐项裁决。`spec update` 不支持强制覆盖门户版本；门户新修订必须重新比较后提交。

## 状态别混

| 层 | 看什么 | 谁能改 |
|---|---|---|
| 套件阶段 | `.workflow-state.json` 的 Draft / Reviewed | AI 写 Draft；人批成 Reviewed |
| 产物门禁 | 门户 `files[].reviewStatus` 的 draft / formal | CLI 只传 draft；门户定稿 |
| 规格生命周期 | 门户 `status`：`todo` / `doing` / `done` / `cancelled` | 「确认开工」全员会签：`todo`→`doing`；「确认收工」全员会签：`doing`→`done`。Skill 都不代点 |
| 人话进度 | CLI status 推导：待完善 / 待开工 / 已开工 | 只用来对人说 |

本地 `Reviewed` ≠ 门户 `formal`；套件开工 ≠ 门户开工。

## ignore

切片 `.gitignore` 补生成物（已有相同行跳过）：

```gitignore
# product-workflow generated
.review-board/
index.html
index.prev.html
review-board.js
review-board-live.js
mermaid.min.js
history/
.workflow-state.json
.product-workflow-portal.json
.limix-artifacts.json
```

读绑定：`.limix-artifacts.json` 优先，没有则读 `.product-workflow-portal.json`（旧名，CLI 会读并迁写）。0.7.x 已有的绑定（当时叫 requirement）直接沿用：CLI 侧自动把旧字段迁写为新键，无需重新 bind。只在 `portal_sync=bound_project` 时创建或更新新名。`off` 时不维护这些文件；关掉门户后旧文件留盘，再打开时问是否复用原规格短号。`localStart` 只在选用门户且尚未 bind 时写入，不算确认开工。

## 失败

鉴权失败、未绑定、切片未定、没有 `limix`、后端不可达：说明原因，不删本地源头，不直写数据库。冲突走 §(d) 三方比较，未经裁决不提交。

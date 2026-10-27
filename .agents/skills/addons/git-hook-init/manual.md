# Git 提交拦截门禁初始化 ($git-hook-init)

`product-workflow-0.9.3`

当团队需要为代码仓建立提交质量防线、防止把未通过测试或格式错误的代码提交到远程分支时，使用本技能快速配置本地 Git 拦截钩子（pre-commit / pre-push）。

---

## 一、解决什么问题

在多人协作或自动化发布流程中：
- 经常有开发者忘记在本地运行单元测试，直接 `git commit` 并推送到远程，导致 CI 持续集成流水线大面积报错；
- 代码格式不统一，在代码评审时充斥着大量无意义的空格和换行噪音；
- 缺乏本地守门机制，质量问题全部被推迟到远端甚至测试环境才暴露。

`$git-hook-init` 探测项目现有的包管理与技术栈，接入轻量级 Hook 管理工具（如 [Lefthook](https://github.com/evilmartians/lefthook)、Husky 或原生 pre-commit），把已经验证过的测试命令和代码检查命令挂载为提交前拦截门禁。

> 💡 **底层拦截原理：本地提交前质量防线流水线**
> 
> Git Hook 运行在开发者的本地机器上，在代码落入本地 Git 历史之前进行拦截把关：
> 
> ```mermaid
> flowchart TD
>     Commit["1. 开发者执行 git commit"] --> HookTrigger["2. 本地 pre-commit 钩子触发拦截"]
>     HookTrigger --> CheckFormat["3. 运行代码格式与 Lint 检查"]
>     CheckFormat --> RunFastTest["4. 执行快速单元测试 (已验证命令)"]
>     RunFastTest --> ExitCheck{"测试与检查结果<br/>Exit Code 判定"}
>     ExitCheck -- "全部通过 (Exit 0)" --> CommitPass["✔ 提交成功，生成本地 Commit 记录"]
>     ExitCheck -- "存在错误 (Exit != 0)" --> CommitFail["✖ 拦截提交并中止！<br/>终端打印具体错误行号与失败用例"]
> ```
> 
> - **零外部依赖**：优先使用项目已有工具链，不强制安装沉重的全局依赖；
> - **紧急豁免机制**：遇到特殊热修复或未完工 WIP 提交时，Git 原生支持 `git commit --no-verify` 跳过拦截，但团队常规交付必须通过检验。

---

## 二、怎么对助手开口

用最平实的工程语言发起配置：

```text
帮当前项目配置一下 Git 提交拦截钩子，在 commit 前自动跑单测和 ESLint 检查。
```

或者使用技能指令：

```text
$git-hook-init
```

---

## 三、运作逻辑与安全边界

1. **先诊断后提方案**：
   助手先只读检查仓库现有的工具链（如 `package.json`、`lefthook.yml` 或 `.pre-commit-config.yaml`）。如果项目已有成熟的 Hook 配置，直接沿用，不重复安装替代工具。
2. **只出方案，批准后落盘**：
   写入任何配置前，助手会向你列出拟修改的文件、配置内容和测试命令，由你明确确认后才执行写入。
3. **分工明确，各司其职**：
   本技能仅负责把已有的可执行命令接入 Git 钩子，**它自身不编写单元测试，也不修改业务代码**。若当前代码仓缺少测试运行环境，先引导通过 [单元测试环境初始化](unit-test-init.html) 补齐基建。

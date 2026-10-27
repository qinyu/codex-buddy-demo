# 可执行测试脚本：先认环境，再选语言

来源：海天问题 8（`init_test_env.sh` 在 Windows 反复报错）+ 问题 7b（PowerShell 写文件带 BOM）。  
生成或修复 `init_test_env.*` 之前**必须**读完本文件。各技术栈 `references/*.md` 只提供命令序列；包装成哪种脚本由本文件决定。

## 1. 先确认执行环境

| 环境 | 生成文件 | 交给用户的运行方式 |
|---|---|---|
| Windows 原生（CMD / Windows PowerShell / pwsh，无 Git Bash） | `init_test_env.ps1` | `powershell -NoProfile -File .\init_test_env.ps1` |
| Git Bash | `init_test_env.sh` | `bash init_test_env.sh` |
| WSL / macOS / Linux | `init_test_env.sh` | `bash init_test_env.sh` |

判断顺序：用户明确说明 > 仓库已有脚本后缀 > 本机 `process.platform` / `$env:OS` / `uname`。不确定就先问，不要默认出 `.sh`。

现场根因：旧模板从 Linux 平移，AI 未认环境就写 `#!/usr/bin/env sh`，在 CMD/PowerShell 里必挂。

## 2. Windows 原生 `.ps1` 规则

- `mvn` → `mvn.cmd`，`npm` → `npm.cmd`，`npx` → `npx.cmd`；Gradle 优先 `gradlew.bat`。
- 路径用仓库绝对路径，或 `$PSScriptRoot` 逐级定位并 `Test-Path` 校验。禁止 `../tpm-fe` 这类相对跳层。
- 文件必须 **UTF-8 无 BOM**。禁止 PowerShell 5.1 的 `Set-Content` / `Out-File` 默认编码。
- 写入方式：Node `fs.writeFile`、Python `open(..., encoding='utf-8')`，或 .NET `UTF8Encoding($false)`。
- 推荐 PowerShell 7（`pwsh`）；仍是 5.1 时读写都显式 UTF-8 且无 BOM。

## 3. `.sh` 仍要自查（Git Bash / WSL）

1. 文件头无 BOM（`EF BB BF` 会导致 `#!/usr/bin/env: No such file or directory`）。
2. `ROOT_DIR` 指向真实仓库根，优先绝对路径。
3. Windows 上的 Git Bash 调用 Maven/npm 时写 `mvn.cmd` / `npm.cmd`。

## 4. 生成后自查（不过不能交用户）

- [ ] 环境与后缀一致
- [ ] 文件头不是 `EF BB BF`
- [ ] 路径存在，无多跳/少跳
- [ ] 工具名适配当前 OS
- [ ] 只生成脚本，**不自动执行**

## 5. 修已有脚本

1. 报错第 1 行 shebang 失效 → BOM；`cd: ... No such file` → 路径。
2. Windows 原生：翻译成 `init_test_env.ps1`，不要在 CMD 里硬修 `.sh`。
3. Git Bash：去 BOM + 绝对路径 + `.cmd`。
4. 沙箱 1385：先切 unelevated，禁止自动重试循环。

## 6. 门禁与豁免（问题 14）

测试基建是开工前置，不是「必须先跑通单测才能写业务代码」。用户明确要求先写功能时，可继续编码，但必须在 `develop.md` 与 `.workflow-state.json` 写明豁免；不得把未验证基建标成已通过；发布前必须补跑。

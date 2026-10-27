# 安装

缺命令时把 stderr 交给人。人装完再跑同一条。引擎装 PATH。

| 命令 | 安装 |
|---|---|
| `git` | git-scm；或 `brew install git` / `winget install Git.Git` |
| `codegraph` | **优先 npm**：`npm i -g @colbymchenry/codegraph`（平台二进制是 optional dep，实测 3 秒完）。只有 npm 不可用时才用 `install.sh`（macOS/Linux）/ `install.ps1`（Windows）：它拉 GitHub release 的 54MB 包，国内直连实测均速 ~245KB/s 且反复断流。装完开新终端再查 PATH |

接 agent（全局改动，需人确认后手动跑）：`codegraph install --yes`。本 skill 只打印不代跑。

## 遥测选择

CodeGraph 安装器**默认打开遥测**，端点 `telemetry.getcodegraph.com`（官方声明不采源码、路径、符号名、IP，但客户端场景不默认放过）。本机实测 `~/.codegraph/telemetry.json` 初值为 `{"enabled": true, "consent_source": "default-notice"}`。

向用户说明遥测状态，单独确认是否关闭。获得全局设置授权后才执行 `codegraph telemetry off`；仅查询或建图授权不包含它。`DO_NOT_TRACK=1` 可作为用户选择的进程级配置，由Setup在章程定稿时记录，不由Wiki另写章程。

状态自查：`codegraph telemetry status`。

PATH 上已有命令则沿用。

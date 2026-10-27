"""LSP 接入：先探测客户端，给该客户端的装法，人确认后才动手。

已核实（一手依据见 spec D5）：四个客户端的机制不同，装法也不同。
Cursor 与 Codex 都**不能**挂外部语言服务器，想给 skill 用只能走 MCP。
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Callable

from code_wiki.tools import platform_name

VERIFY_KINDS = ("definition", "references", "diagnostics")

# 已核实的客户端矩阵。command 为 None 表示没有一键命令（走手工配置）。
CLIENT_MATRIX: dict[str, dict[str, Any]] = {
    "claude-code": {
        "bin": "claude",
        "label": "Claude Code",
        "mechanism": "官方插件市场有 LSP 插件；也可用 plugin.json 的 lspServers 自建；或经 MCP 接 Serena",
        "command": "serena setup claude-code",
        "manual": 'claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd',
        "verify": "运行 /mcp 确认 Serena 已连接",
        "canAttachExternalServer": True,
    },
    "codex": {
        "bin": "codex",
        "label": "Codex",
        "mechanism": "无内置 LSP，走 MCP",
        "command": "serena setup codex",
        "manual": '[mcp_servers.serena]  command = "serena"  args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]',
        "verify": "运行 /mcp 确认 Serena 已连接",
        "canAttachExternalServer": True,
    },
    "opencode": {
        "bin": "opencode",
        "label": "OpenCode",
        "mechanism": "opencode.json 的 lsp 段；多数语言开箱即有（内置含 C#，需 .NET SDK）",
        "command": "",
        "manual": '{"lsp": {}}  保留内置并叠加自定义；自定义项字段：command / extensions / env / initialization',
        "verify": "编辑器内诊断可见",
        "canAttachExternalServer": True,
    },
    "cursor": {
        "bin": "cursor",
        "label": "Cursor",
        "mechanism": "有 LSP 开关组（Enable LSPs 等），但只能开关内置与限制并发数，**不能挂外部 server**",
        "command": "",
        "manual": "设置页 Code Intelligence → LSP；worktree 内用符号能力需手动打开 Enable LSPs for Worktrees（默认关）",
        "verify": "设置页可见；agent worktree 内需另开开关",
        "canAttachExternalServer": False,
    },
    "code-vt": {
        "bin": "",
        "label": "智脉 / Code VT",
        "mechanism": "企业客户端。skill 调符号仍走 MCP（Serena --context ide）；不把 Git Bash 当运行时",
        "command": "",
        "manual": "在智脉里打开工作区后接 Serena MCP（--context ide）。Windows 用 PowerShell，不要用 Git Bash",
        "verify": "客户端能列出 MCP 工具；定义/引用/诊断三项可查",
        "canAttachExternalServer": True,
    },
}

SERENA_INSTALL = {
    "mac": ["uv tool install -p 3.13 serena-agent", "serena init"],
    "windows": [
        "uv tool install -p 3.13.15 serena-agent",
        "serena init",
    ],
}


class LspError(RuntimeError):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def current_client(*, env: dict[str, str] | None = None) -> str | None:
    """用户当前正在用的客户端。只认进程/环境里已经在跑的那个，不扫 PATH 上所有编辑器。"""
    import os

    environ = env if env is not None else os.environ
    markers = (
        ("claude-code", ("CLAUDE_CODE", "CLAUDECODE")),
        ("codex", ("CODEX_HOME", "CODEX_SESSION")),
        ("opencode", ("OPENCODE", "OPENCODE_SESSION")),
        ("cursor", ("CURSOR_SESSION", "CURSOR_TRACE_ID", "CURSOR_AGENT")),
        ("code-vt", ("LIMIX_CODE_VT", "CODE_VT", "CODEVT", "LIMIX_DESKTOP")),
    )
    for client, keys in markers:
        if any(environ.get(k) for k in keys):
            return client
    return None


def detect_clients(*, which_fn=shutil.which) -> list[dict[str, Any]]:
    """按 PATH 探测已安装客户端；只有环境标记能认出正在用的那个。"""
    found = []
    current = current_client()
    if current == "code-vt":
        found.append({"client": "code-vt", "label": CLIENT_MATRIX["code-vt"]["label"], "bin": "env"})
    for key, spec in CLIENT_MATRIX.items():
        if key == "code-vt" or not spec.get("bin"):
            continue
        try:
            located = which_fn(spec["bin"])
        except TypeError:
            located = which_fn(spec["bin"], None)
        if located:
            found.append({"client": key, "label": spec["label"], "bin": located})
    if current:
        matching = [row for row in found if row["client"] == current]
        if matching:
            return matching
        return [{"client": current, "label": CLIENT_MATRIX[current]["label"], "bin": "env"}]
    return found


def lsp_plan(client: str, *, system: str | None = None) -> dict[str, Any]:
    """给这个客户端该装什么、怎么装、怎么验。未确认前不执行。"""
    spec = CLIENT_MATRIX.get(client)
    if spec is None:
        raise LspError(f"未知客户端：{client}（支持 {'/'.join(CLIENT_MATRIX)}）", 1)
    plat = platform_name(system)
    return {
        "client": client,
        "label": spec["label"],
        "mechanism": spec["mechanism"],
        "canAttachExternalServer": spec["canAttachExternalServer"],
        "oneLiner": spec["command"],
        "manual": spec["manual"],
        "serenaInstall": SERENA_INSTALL[plat],
        "verify": spec["verify"],
        "gate": "安装前必须人确认；未确认不执行",
        "notes": _notes(client),
    }


def _notes(client: str) -> list[str]:
    if client == "cursor":
        return [
            "Cursor 自带的 LSP 是给它自己（编辑器 UI 与它的 AI）用的，不对外暴露查询接口。",
            "所以「明明能跳转定义」不等于 skill 能查到符号 —— 想给 skill 用仍需 MCP。",
            "Cursor 自带的 Index Repositories for Instant Grep 与 CodeGraph 是两套索引，互不互通。",
        ]
    if client == "codex":
        return [
            "Codex 官方未内置 LSP（Issue #8745 仍在呼吁）；官方市场也没有 LSP 插件。",
            "唯一可行路径是 MCP。",
            "github.com 超时不要从 redhat vscode-java VSIX 拉 jdtls；改 Eclipse 上游 + lombok + JDK 21。",
            "某一语言服务器起不来时从 language_servers 摘掉它，其余语言继续。",
        ]
    if client == "claude-code":
        return [
            "Claude Code 官方插件市场**有** LSP 插件（/plugin 里搜 lsp），这一点与 Codex 不同。",
            "被内置工具抢注意力时可用 Serena 的 hooks 提醒（alpha）。",
        ]
    if client == "opencode":
        return [
            "多数语言开箱即有；C# 需先装 .NET SDK。",
            "缺 SDK 时只提示，不静默安装。",
        ]
    if client == "code-vt":
        return [
            "Windows 现场用 PowerShell；Git Bash 只作 Git 自带工具，不作为运行时。",
            "github.com 超时不要从 redhat vscode-java VSIX 拉 jdtls。",
            "改用 Eclipse 上游：download.eclipse.org 的 jdt-language-server + projectlombok.org 的 lombok.jar + JDK 21。",
            "某一语言服务器起不来时，从 language_servers 摘掉它，其余语言继续。",
        ]
    return [
        "github.com 不可达时，jdtls 走 Eclipse 上游包，不要下 redhat vscode-java VSIX。",
        "某一语言启动失败时从 language_servers 摘掉它，避免拖垮 TypeScript / Vue。",
    ]


def cli_plan(*, which_fn=shutil.which, system: str | None = None) -> dict[str, Any]:
    """探测 + 只给当前客户端出方案；PATH 上的其余客户端列进 installed，等人点名。"""
    found = detect_clients(which_fn=which_fn)
    detected = found if current_client() else []
    installed = [] if detected else found
    if detected:
        message = "已探测到客户端；按 plans 给装法，等人确认后再执行。"
    elif installed:
        message = "认不出你正在用的客户端。已装：" + "、".join(row["label"] for row in installed) + "。说一声用哪个，再给接法。"
    else:
        message = "未探测到已安装的客户端。先确认用哪个（Cursor / Claude Code / OpenCode / Codex / 智脉）。"
    return {
        "detected": detected,
        "installed": installed,
        "plans": [lsp_plan(row["client"], system=system) for row in detected],
        "gate": "安装前必须人确认；本命令只出方案，不执行安装",
        "message": message,
    }


# --- 安装门禁 ---


def install(client: str, *, confirmed: bool = False, run_cmd=None) -> dict[str, Any]:
    """未确认不执行。client 无一键命令时把手工配置交给人。"""
    if not confirmed:
        raise LspError("安装 LSP 需要人确认；未确认不执行。", 3)
    spec = CLIENT_MATRIX.get(client)
    if spec is None:
        raise LspError(f"未知客户端：{client}", 1)
    if not spec["command"]:
        return {
            "client": client,
            "installed": False,
            "next": "manual",
            "manual": spec["manual"],
            "message": f"{spec['label']} 没有一键命令，按 manual 手工配置。",
        }
    from code_wiki.proc import run_process

    argv = spec["command"].split()
    runner = run_process if run_cmd is None else run_cmd
    result = runner(argv)
    return {"client": client, "installed": result.returncode == 0, "argv": argv,
            "stderr": (result.stderr or "").strip()}


# --- 验证记录 ---


def verification_path(project_root: str | Path) -> Path:
    return Path(project_root).resolve() / "docs" / "project-wiki" / "lsp-verification.json"


def record_verification(
    project_root: str | Path,
    *,
    client: str,
    results: dict[str, bool],
    write: bool = True,
) -> dict[str, Any]:
    """三项（定义/引用/诊断）全通才算通。缺一项判未通。"""
    missing = [kind for kind in VERIFY_KINDS if kind not in results]
    if missing:
        raise LspError(f"验证记录缺项：{'、'.join(missing)}；三项各跑一次才算完。", 1)
    passed = all(bool(results[kind]) for kind in VERIFY_KINDS)
    body = {
        "client": client,
        "results": {kind: bool(results[kind]) for kind in VERIFY_KINDS},
        "passed": passed,
        "verdict": "已通" if passed else "未通（三项须全过）",
    }
    if write:
        dest = verification_path(project_root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        body["path"] = str(dest)
    return body


def read_verification(project_root: str | Path) -> dict[str, Any] | None:
    dest = verification_path(project_root)
    if not dest.exists():
        return None
    return json.loads(dest.read_text(encoding="utf-8"))

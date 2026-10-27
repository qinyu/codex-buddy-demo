"""起本机 CLI。Windows 上 npm 的 .cmd 必须走 cmd /c；输出按 UTF-8 读。"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit, urlunsplit

from code_wiki.tools import which

RunCmd = Callable[..., subprocess.CompletedProcess[str]]


def utf8_run_kwargs() -> dict[str, Any]:
    return {"text": True, "capture_output": True, "encoding": "utf-8", "errors": "replace"}


def uses_ssh(url: str) -> bool:
    text = (url or "").strip()
    return text.startswith("git@") or text.startswith("ssh://")


def clone_url_for_git(url: str) -> tuple[str, bool]:
    """clone 用的地址。HTTPS 里的用户名口令剥掉，交给凭据管理器。"""
    text = (url or "").strip()
    if not text or uses_ssh(text) or "://" not in text:
        return text, False
    parts = urlsplit(text)
    if not (parts.username or parts.password):
        return text, False
    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    return urlunsplit((parts.scheme, host, parts.path, parts.query, parts.fragment)), True


def wrap_windows_argv(argv: list[str], resolved: str) -> list[str]:
    """CreateProcess 不解析 PATHEXT；.cmd / .bat 交给 cmd /c。"""
    suffix = Path(resolved).suffix.lower()
    if suffix in {".cmd", ".bat"}:
        return ["cmd", "/c", resolved, *argv[1:]]
    return [resolved, *argv[1:]]


def resolve_argv(argv: list[str], *, which_fn=which) -> list[str]:
    if not argv:
        return argv
    try:
        located = which_fn(argv[0])
    except TypeError:
        located = which_fn(argv[0], None)
    if not located:
        return list(argv)
    return wrap_windows_argv(argv, located)


def run_process(
    argv: list[str],
    *,
    cwd: str | None = None,
    input: str | None = None,
    timeout: float | None = None,
    which_fn=which,
) -> subprocess.CompletedProcess[str]:
    wrapped = resolve_argv(argv, which_fn=which_fn)
    kwargs: dict[str, Any] = {
        "args": wrapped,
        "check": False,
        **utf8_run_kwargs(),
    }
    if cwd is not None:
        kwargs["cwd"] = cwd
    if input is not None:
        kwargs["input"] = input
    if timeout is not None:
        kwargs["timeout"] = timeout
    return subprocess.run(**kwargs)

"""PATH 探测与安装提示。缺命令时把安装段交给人。"""

from __future__ import annotations

import os
import shutil
import sys
from dataclasses import dataclass, field

REQUIRED_FOR_CLONE = ("git",)
REQUIRED_FOR_GRAPH = ("codegraph",)


def which(cmd: str, path: str | None = None) -> str | None:
    return shutil.which(cmd, path=path)


def platform_name(system: str | None = None) -> str:
    name = (system or sys.platform).lower()
    if name.startswith("win"):
        return "windows"
    return "mac"


def install_lines(cmd: str) -> dict[str, list[str]]:
    """Mac / Windows 对照。键稳定，方便测。"""
    table = {
        "git": {
            "mac": ["https://git-scm.com/download/mac", "brew install git"],
            "windows": ["https://git-scm.com/download/win", "winget install Git.Git"],
        },
        "uv": {
            "mac": [
                "https://docs.astral.sh/uv/getting-started/installation/",
                "brew install uv",
                "curl -LsSf https://astral.sh/uv/install.sh | sh",
            ],
            "windows": [
                "https://docs.astral.sh/uv/getting-started/installation/",
                "winget install astral-sh.uv",
                "irm https://astral.sh/uv/install.ps1 | iex",
            ],
        },
        "codegraph": {
            "mac": [
                "npm i -g @colbymchenry/codegraph",
                "https://www.npmjs.com/package/@colbymchenry/codegraph",
                "https://github.com/colbymchenry/codegraph",
            ],
            "windows": [
                "npm i -g @colbymchenry/codegraph",
                "https://www.npmjs.com/package/@colbymchenry/codegraph",
                "https://github.com/colbymchenry/codegraph",
            ],
        },
    }
    return table.get(cmd, {"mac": [f"安装 {cmd}"], "windows": [f"安装 {cmd}"]})


def format_hint(missing: list[str], system: str | None = None) -> str:
    if not missing:
        return ""
    plat = platform_name(system)
    other = "windows" if plat == "mac" else "mac"
    lines = [
        "缺 " + "、".join(missing) + "。把对应安装命令交给人，装完再跑同一条。",
        "引擎装 PATH。",
        "",
    ]
    for cmd in missing:
        rows = install_lines(cmd)
        lines.append(f"## {cmd}")
        lines.append(f"{plat}：")
        lines.extend(f"  {item}" for item in rows[plat])
        lines.append(f"{other}：")
        lines.extend(f"  {item}" for item in rows[other])
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


@dataclass
class Probe:
    missing: list[str] = field(default_factory=list)
    found: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.missing

    def hint(self, system: str | None = None) -> str:
        return format_hint(self.missing, system=system)


def probe_commands(
    commands: list[str],
    *,
    path: str | None = None,
    which_fn=which,
) -> Probe:
    found: dict[str, str] = {}
    missing: list[str] = []
    for cmd in commands:
        try:
            located = which_fn(cmd, path)
        except TypeError:
            located = which_fn(cmd)
        if located:
            found[cmd] = located
        else:
            missing.append(cmd)
    return Probe(missing=missing, found=found)


def probe_clone(**kwargs) -> Probe:
    return probe_commands(list(REQUIRED_FOR_CLONE), **kwargs)


def probe_graph(**kwargs) -> Probe:
    return probe_commands(list(REQUIRED_FOR_GRAPH), **kwargs)


def current_path() -> str:
    return os.environ.get("PATH", "")

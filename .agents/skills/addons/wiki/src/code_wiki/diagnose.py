"""图是否就位。CodeGraph 默认自动同步，freshness 靠引擎自己的机制。"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Callable

from code_wiki.discover import discover_repos

RunCmd = Callable[..., subprocess.CompletedProcess[str]]

GRAPH_DIR = ".codegraph"
# CodeGraph 不在仓内落 git commit；若将来出现元数据文件，这里读它，不做猜测。
META_CANDIDATES = ("meta.json", "state.json")


def _run(argv: list[str]) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(argv)


def git_head(repo_abs: str | Path, *, run_cmd: RunCmd = _run) -> str | None:
    ran = run_cmd(["git", "-C", str(repo_abs), "rev-parse", "HEAD"])
    if ran.returncode != 0:
        return None
    return (ran.stdout or "").strip() or None


def graph_dir(repo_abs: str | Path) -> Path:
    return Path(repo_abs) / GRAPH_DIR


def graph_present(repo_abs: str | Path) -> bool:
    return graph_dir(repo_abs).is_dir()


def graph_commit(repo_abs: str | Path) -> str | None:
    """有元数据文件才读；没有就返回 None（不拿别的字段凑）。"""
    base = graph_dir(repo_abs)
    for name in META_CANDIDATES:
        candidate = base / name
        if not candidate.exists():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        if not isinstance(data, dict):
            return None
        return data.get("commit") or data.get("git_commit") or data.get("head")
    return None


def diagnose_repo(repo: dict[str, str], *, run_cmd: RunCmd = _run) -> dict[str, Any]:
    head = git_head(repo["absPath"], run_cmd=run_cmd)
    present = graph_present(repo["absPath"])
    recorded = graph_commit(repo["absPath"]) if present else None
    if not present:
        status = "no-graph"
    elif not head:
        status = "no-git"
    elif not recorded:
        # 图在，但引擎不落 commit：靠 codegraph 的文件监听自愈，refresh 只做对账。
        status = "built"
    elif recorded == head:
        status = "fresh"
    else:
        status = "stale"
    return {
        "alias": repo["alias"],
        "path": repo["path"],
        "absPath": repo["absPath"],
        "head": head,
        "graph_commit": recorded,
        "graph_present": present,
        "status": status,
    }


def diagnose_workspace(project_root: str | Path, *, run_cmd: RunCmd = _run) -> dict[str, Any]:
    repos = discover_repos(project_root)
    reports = [diagnose_repo(repo, run_cmd=run_cmd) for repo in repos]
    stale = [row for row in reports if row["status"] == "stale"]
    return {
        "repos": reports,
        "stale": [row["alias"] for row in stale],
        "built": [row["alias"] for row in reports if row["status"] == "built"],
        "fresh": all(row["status"] in {"fresh", "built"} for row in reports) if reports else False,
    }

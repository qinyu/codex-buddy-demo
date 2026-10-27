"""从 code-review-graph 迁到 CodeGraph：先报告，人确认后清干净再重建。

不保留双份 —— 旧引擎的运行时数据、章程段、.gitignore 条目一并清除。
知识资产（词表、仓清单、structure 块）与 provider 无关，原样保留。
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

from code_wiki.charter import (
    agents_path,
    apply_gitignore,
    default_knowledge,
    upsert_charter,
)
from code_wiki.discover import discover_repos
from code_wiki.init import plan_commands, run_argv
from code_wiki.tools import probe_graph

LEGACY_DIR = ".code-review-graph"
LEGACY_IGNORE_LINE = ".code-review-graph/"
LEGACY_TOOL = "code-review-graph"
MANIFEST = Path("docs") / "project-wiki" / "code-wiki-repos.json"
GLOSSARY_DIR = Path("docs") / "project-wiki" / "glossary"

RunCmd = Callable[..., subprocess.CompletedProcess[str]]


class MigrateError(RuntimeError):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def _run(argv: list[str]) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(argv)


def global_registry_path() -> Path:
    return Path.home() / LEGACY_DIR / "registry.json"


def detect_legacy(project_root: str | Path) -> dict[str, Any]:
    """只看证据，不改任何东西。"""
    root = Path(project_root).resolve()
    repos = discover_repos(root)
    repo_hits = [row for row in repos if (Path(row["absPath"]) / LEGACY_DIR).is_dir()]
    gitignore = root / ".gitignore"
    gitignore_text = gitignore.read_text(encoding="utf-8") if gitignore.exists() else ""
    agents = agents_path(root)
    agents_text = agents.read_text(encoding="utf-8") if agents.exists() else ""
    registry = global_registry_path()
    found = bool(
        repo_hits
        or registry.exists()
        or LEGACY_IGNORE_LINE in gitignore_text
        or LEGACY_TOOL in agents_text
    )
    return {
        "found": found,
        "repoGraphs": [row["alias"] for row in repo_hits],
        "repoAbsPaths": [row["absPath"] for row in repo_hits],
        "globalRegistry": str(registry) if registry.exists() else "",
        "gitignoreMentionsLegacy": LEGACY_IGNORE_LINE in gitignore_text,
        "charterMentionsLegacy": LEGACY_TOOL in agents_text,
    }


def migration_report(project_root: str | Path) -> dict[str, Any]:
    """给人看的迁移计划。未确认前不执行任何写操作。"""
    detected = detect_legacy(project_root)
    root = Path(project_root).resolve()
    will_delete = [f"{abs_path}/{LEGACY_DIR}/" for abs_path in detected["repoAbsPaths"]]
    if detected["globalRegistry"]:
        will_delete.append(detected["globalRegistry"])
    if detected["gitignoreMentionsLegacy"]:
        will_delete.append(f"{root}/.gitignore 里的 {LEGACY_IGNORE_LINE} 条目（换成 .codegraph/）")
    if detected["charterMentionsLegacy"]:
        will_delete.append(f"{agents_path(root)} 的 code-wiki:knowledge 段（换成 CodeGraph）")
    will_keep = [
        str(root / MANIFEST) + "（仓清单，与引擎无关）",
        str(root / GLOSSARY_DIR) + "/（业务词表，与引擎无关）",
        "AGENTS.md 的 code-wiki:structure 块（源码抽出的模块与惯例）",
    ]
    message = (
        "未检测到旧引擎（code-review-graph）数据，无需迁移。"
        if not detected["found"]
        else (
            "检测到旧引擎数据。清除范围与保留范围见 will_delete / will_keep；"
            "确认后加 --yes 执行。重建用 codegraph init，逐仓进行。"
        )
    )
    return {
        "detected": detected,
        "will_delete": will_delete,
        "will_keep": will_keep,
        "next": "confirm-then-run-with-yes" if detected["found"] else "nothing-to-do",
        "message": message,
    }


def purge_legacy(project_root: str | Path, *, dry_run: bool = False) -> dict[str, Any]:
    """清运行时数据、改章程段、换 .gitignore 条目。幂等。"""
    root = Path(project_root).resolve()
    detected = detect_legacy(root)
    removed: list[str] = []
    for abs_path in detected["repoAbsPaths"]:
        target = Path(abs_path) / LEGACY_DIR
        if not dry_run and target.exists():
            shutil.rmtree(target)
        removed.append(str(target))
    registry = global_registry_path()
    if registry.exists():
        if not dry_run:
            registry.unlink()
            parent = registry.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
        removed.append(str(registry))
    gitignore = apply_gitignore(root, dry_run=dry_run)
    charter_path = None
    aliases = [row["alias"] for row in discover_repos(root)]
    knowledge = default_knowledge(aliases=aliases or None)
    agents = agents_path(root)
    if agents.exists():
        if not dry_run:
            agents.write_text(
                upsert_charter(agents.read_text(encoding="utf-8"), knowledge=knowledge),
                encoding="utf-8",
            )
        charter_path = str(agents)
    return {"removed": removed, "gitignore": gitignore["dest"], "charter": charter_path}


def migrate(
    project_root: str | Path,
    *,
    dry_run: bool = False,
    confirmed: bool = False,
    which_fn=None,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    """报告 → （人确认）→ 清除 → 重建。未确认时不写任何东西。"""
    root = Path(project_root).resolve()
    report = migration_report(root)
    if not report["detected"]["found"]:
        return {**report, "alreadyClean": True, "purged": None, "rebuilt": [], "logs": []}
    if not confirmed and not dry_run:
        raise MigrateError(
            "检测到旧引擎数据，未执行。先看 migration_report，确认后加 --yes。",
            3,
        )
    purged = purge_legacy(root, dry_run=dry_run)
    repos = discover_repos(root)
    probe_kwargs = {"which_fn": which_fn} if which_fn else {}
    probe = probe_graph(**probe_kwargs)
    if not probe.ok:
        # 清除已完成；重建缺引擎时把安装段交给人，不回滚
        return {
            **report,
            "alreadyClean": False,
            "purged": purged,
            "rebuilt": [],
            "logs": [probe.hint()],
            "next": "install-then-init",
            "hint": probe.hint(),
        }
    rebuilt: list[str] = []
    logs: list[str] = []
    for item in plan_commands(repos):
        status, out = run_argv(item["argv"], dry_run=dry_run, run_cmd=run_cmd)
        if out:
            logs.append(out)
        if status != 0:
            raise MigrateError(out or "codegraph init 失败", status)
        rebuilt.append(item["repo"])
    return {
        **report,
        "alreadyClean": False,
        "purged": purged,
        "rebuilt": rebuilt,
        "logs": logs,
        "next": "done",
        "note": "如需卸载旧 CLI，手动执行：pipx uninstall code-review-graph",
    }

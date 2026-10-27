"""分仓建图。缺 CLI 停，stderr 交给人。"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from code_wiki.charter import (
    agents_path,
    apply_gitignore,
    charter_present,
    default_knowledge,
    default_prompt,
    skeleton_document,
    upsert_charter,
)
from code_wiki.discover import discover_repos
from code_wiki.diagnose import diagnose_workspace
from code_wiki.tools import probe_clone, probe_graph
from code_wiki.workspace import (
    MANIFEST_NAME,
    discard_manifest_if_complete,
    manifest_path,
    pending_clones,
    prepare_workspace,
    read_manifest,
    write_workspace_file,
)

RunCmd = Callable[[list[str]], subprocess.CompletedProcess[str]]


class InitError(RuntimeError):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def forbidden(argv: list[str]) -> str | None:
    """拦住改全局或删东西的调用：这些交给人手动跑。"""
    head = argv[:2]
    if head == ["codegraph", "install"] and "--yes" not in argv:
        return "接 agent 用非交互的 `codegraph install --yes`；交互式安装器交给人跑"
    if head == ["codegraph", "uninstall"]:
        return "codegraph uninstall 会摘掉各 agent 的配置，交给人手动执行"
    if head == ["codegraph", "uninit"]:
        return "codegraph uninit 会删项目索引，交给人手动执行"
    return None


def plan_commands(repos: list[dict[str, str]]) -> list[dict[str, Any]]:
    """CodeGraph 一步建库：init 同时建目录与全量图。"""
    return [{"repo": repo["alias"], "argv": ["codegraph", "init", repo["absPath"]]} for repo in repos]


def write_manifest(project_root: str | Path, repos: list[dict[str, str]], extra: dict[str, Any] | None = None) -> Path:
    dest_dir = Path(project_root) / "docs" / "project-wiki"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "code-wiki-repos.json"
    body = {
        "provider": "codegraph",
        "generated_at": (extra or {}).get("generated_at") or datetime.now(timezone.utc).isoformat(),
        "repos": [{"alias": r["alias"], "path": r["path"], "absPath": r["absPath"]} for r in repos],
    }
    dest.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dest


def _run(argv: list[str]) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(argv)


def run_argv(
    argv: list[str],
    *,
    dry_run: bool = False,
    degrade_on_fail: bool = False,
    run_cmd: RunCmd = _run,
) -> tuple[int, str]:
    bad = forbidden(argv)
    if bad:
        raise InitError(bad, 1)
    line = " ".join(json.dumps(p) if " " in p else p for p in argv)
    if dry_run:
        return 0, f"[dry-run] {line}\n"
    runner = _run if run_cmd is None else run_cmd
    result = runner(argv)
    out = (result.stdout or "") + (result.stderr or "")
    status = result.returncode if result.returncode is not None else 1
    if status != 0 and degrade_on_fail:
        return 0, out + f"embed 失败，本仓仅 FTS：{line}\n"
    return status, out


def init_graphs(
    project_root: str | Path,
    *,
    dry_run: bool = False,
    allow_install: bool = False,
    which_fn=None,
    run_cmd: RunCmd = _run,
    now: str | None = None,
) -> dict[str, Any]:
    root = Path(project_root).resolve()
    repos = discover_repos(root)
    if not repos:
        raise InitError("未发现 git 根（maxdepth 3）。先 ensure / init --alias --url。", 1)
    graph_kwargs = {"which_fn": which_fn} if which_fn else {}
    probe = probe_graph(**graph_kwargs)
    if not probe.ok:
        raise InitError(probe.hint(), 2)
    notes = []
    if allow_install:
        notes.append("--allow-install 已忽略：安装命令在 stderr，交给人。")
    notes.append(
        "接 agent（全局，需人确认后手动跑）：codegraph install --yes；只打印不代跑。"
    )
    commands = plan_commands(repos)
    logs = []
    status, out = run_argv(["codegraph", "telemetry", "off"], dry_run=dry_run, run_cmd=run_cmd)
    if status != 0:
        raise InitError(out or "关闭 CodeGraph 遥测失败", status)
    for item in commands:
        status, out = run_argv(
            item["argv"],
            dry_run=dry_run,
            degrade_on_fail=bool(item.get("degrade_on_fail")),
            run_cmd=run_cmd,
        )
        if out:
            logs.append(out)
        if status != 0:
            raise InitError(out or "命令失败", status)
    gitignore = apply_gitignore(root, dry_run=dry_run)
    extra = {"generated_at": now} if now else None
    manifest = write_manifest(root, repos, extra)
    aliases = [repo["alias"] for repo in repos]
    knowledge = default_knowledge(aliases=aliases)
    prompt = default_prompt(repo_count=len(repos), aliases=aliases)
    agents_path = root / "AGENTS.md"
    charter_path = None
    if not dry_run:
        if agents_path.exists():
            next_text = upsert_charter(agents_path.read_text(encoding="utf-8"), knowledge=knowledge, prompt=prompt)
            agents_path.write_text(next_text, encoding="utf-8")
        else:
            agents_path.write_text(skeleton_document(knowledge=knowledge, prompt=prompt), encoding="utf-8")
        charter_path = str(agents_path)
    return {
        "repos": repos,
        "dryRun": dry_run,
        "gitignore": gitignore["dest"],
        "manifest": str(manifest),
        "charter": charter_path,
        "commands": [c["argv"] for c in commands],
        "notes": notes,
        "logs": logs,
    }


def init_workspace(
    workspace_dir: str | Path,
    *,
    repos_file: str | Path | None = None,
    repo: str = "",
    dir: str = "",
    branch: str = "",
    dry_run: bool = False,
    run_git=None,
    **graph_kwargs,
) -> dict[str, Any]:
    which_fn = graph_kwargs.get("which_fn")
    clone_probe = probe_clone(which_fn=which_fn) if which_fn else probe_clone()
    if repo or repos_file:
        if not clone_probe.ok:
            raise InitError(clone_probe.hint(), 2)
    kwargs = {
        "repo": repo,
        "branch": branch,
        "dir": dir,
        "repos_file": repos_file,
        "dry_run": dry_run,
    }
    if run_git:
        kwargs["run_git"] = run_git
    prepared = prepare_workspace(workspace_dir, **kwargs)
    if prepared["action"] == "need-repo":
        raise InitError("空工作区需要仓库清单（别名=地址）或 --repo <url>。", 2)
    failed = [
        {"alias": row.get("alias") or "", "url": row.get("url") or "", "error": row.get("error") or ""}
        for row in prepared.get("repos") or []
        if row.get("action") == "failed"
    ]
    if dry_run and not discover_repos(workspace_dir):
        return {"prepared": prepared, "graphs": None, "failed": failed}
    if not discover_repos(workspace_dir):
        return {"prepared": prepared, "graphs": None, "failed": failed}
    graphs = init_graphs(workspace_dir, dry_run=dry_run, **graph_kwargs)
    return {"prepared": prepared, "graphs": graphs, "failed": failed}


def bootstrap(
    workspace_dir: str | Path,
    *,
    repositories: list[dict[str, str]] | None = None,
    repos_file: str | Path | None = None,
    repo: str = "",
    dir: str = "",
    branch: str = "",
    dry_run: bool = False,
    name: str = "",
    run_git=None,
    **graph_kwargs,
) -> dict[str, Any]:
    workspace = Path(workspace_dir).resolve()
    written = None
    if repositories:
        written = write_workspace_file(workspace, name=name, repositories=repositories)
        repos_file = written["dest"]
    elif not repos_file:
        default_list = manifest_path(workspace)
        if default_list.exists() or read_manifest(workspace):
            repos_file = str(default_list if default_list.exists() else workspace / "workspace.json")
    prepared = None
    if repos_file or repo:
        prepared = init_workspace(
            workspace,
            repos_file=repos_file,
            repo=repo,
            dir=dir,
            branch=branch,
            dry_run=dry_run,
            run_git=run_git,
            **graph_kwargs,
        )
        return {"written": written, **prepared}
    discovered = discover_repos(workspace)
    if discovered:
        graphs = init_graphs(workspace, dry_run=dry_run, **graph_kwargs)
        return {"written": written, "prepared": None, "graphs": graphs}
    raise InitError("空工作区需要 --alias/--url，或一份 别名=地址 清单。", 2)


def refresh_graphs(
    project_root: str | Path,
    *,
    dry_run: bool = False,
    which_fn=None,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    """体检 + 增量对账。CodeGraph 默认监听文件变更，这里只做兜底。"""
    report = diagnose_workspace(project_root, run_cmd=run_cmd)
    targets = [row for row in report["repos"] if row["graph_present"]]
    if targets:
        graph_kwargs = {"which_fn": which_fn} if which_fn else {}
        probe = probe_graph(**graph_kwargs)
        if not probe.ok:
            raise InitError(probe.hint(), 2)
    updated: list[str] = []
    logs: list[str] = []
    commands: list[list[str]] = []
    for row in targets:
        argv = ["codegraph", "sync", row["absPath"]]
        commands.append(argv)
        status, out = run_argv(argv, dry_run=dry_run, run_cmd=run_cmd)
        if out:
            logs.append(out)
        if status != 0:
            raise InitError(out or "sync 失败", status)
        updated.append(row["alias"])
    return {
        **report,
        "updated": updated,
        "no_graph": [row["alias"] for row in report["repos"] if not row["graph_present"]],
        "commands": commands,
        "logs": logs,
        "dryRun": dry_run,
    }


def inspect_agents(project_root: str | Path) -> dict[str, Any]:
    dest = agents_path(project_root)
    if not dest.exists():
        return {"path": str(dest), "exists": False, "has_charter": False}
    text = dest.read_text(encoding="utf-8")
    return {"path": str(dest), "exists": True, "has_charter": charter_present(text)}


def ensure(
    project_root: str | Path,
    *,
    dry_run: bool = False,
    run_git=None,
    **graph_kwargs,
) -> dict[str, Any]:
    root = Path(project_root).resolve()
    repos = discover_repos(root)
    agents = inspect_agents(root)
    missing = pending_clones(root)
    has_list = bool(read_manifest(root))
    if not repos and not has_list:
        return {
            "next": "ask-repos",
            "message": (
                "工作区没有 git 仓。只发一轮：仓库清单一行一个 别名=地址；"
                "代码放哪；SSH 还是 Token 是否已准备。"
                "回答后按清单 clone、建图、补章程；拉齐就丢清单，不进项目配置。"
            ),
            "repos": [],
            "agents": agents,
        }
    graphs = None
    refresh_kwargs = {k: graph_kwargs[k] for k in ("which_fn", "run_cmd") if k in graph_kwargs}
    if missing:
        # 过程清单里还有没拉到的仓：按原清单补 clone，不重新问。
        list_file = manifest_path(root)
        if not list_file.exists():
            list_file = root / "workspace.json"
        graphs = init_workspace(
            root,
            repos_file=list_file,
            dry_run=dry_run,
            run_git=run_git,
            **graph_kwargs,
        )
        repos = discover_repos(root)
        agents = inspect_agents(root)
    elif repos and (
        not agents["has_charter"]
        or not (root / "docs" / "project-wiki" / "code-wiki-repos.json").exists()
    ):
        graphs = init_graphs(root, dry_run=dry_run, **graph_kwargs)
        agents = inspect_agents(root)
    refreshed = refresh_graphs(root, dry_run=dry_run, **refresh_kwargs) if repos else None
    failed = (graphs or {}).get("failed") or []
    discarded = False
    if not dry_run and not failed:
        discarded = discard_manifest_if_complete(root)
    return {
        "next": "retry-clone" if failed else "ready",
        "repos": repos,
        "agents": agents,
        "graphs": graphs,
        "refresh": refreshed,
        "failed": failed,
        "discardedManifest": discarded,
    }

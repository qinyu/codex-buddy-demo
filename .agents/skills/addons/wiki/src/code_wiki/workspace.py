"""拉仓清单与 clone。清单是过程记录：一行 alias=url，拉齐即删。"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

RunGit = Callable[[list[str]], subprocess.CompletedProcess[str]]


class WorkspaceError(ValueError):
    pass


MANIFEST_NAME = "repos.txt"
LEGACY_JSON_NAME = "workspace.json"


def parse_repo_line(line: str, *, index: int = 0) -> dict[str, str] | None:
    """一行一个仓。支持 alias=url、alias=url @branch。# 开头是注释。"""
    text = (line or "").strip()
    if not text or text.startswith("#"):
        return None
    branch = ""
    if " @" in text:
        text, _, rest = text.partition(" @")
        branch = rest.strip()
        text = text.strip()
    if "=" in text:
        alias, _, url = text.partition("=")
        alias, url = alias.strip(), url.strip()
    else:
        alias, url = "", text
    if not url:
        return None
    alias = slug_alias(alias, f"repo{index + 1}")
    return {"alias": alias, "url": url, "path": alias, "branch": branch}


def parse_repo_list(text: str) -> list[dict[str, str]]:
    rows = []
    for index, line in enumerate((text or "").splitlines()):
        row = parse_repo_line(line, index=index)
        if row:
            rows.append(row)
    return rows


def _safe_repo(row: dict[str, str]) -> dict[str, str]:
    from code_wiki.proc import clone_url_for_git

    safe, stripped = clone_url_for_git(row.get("url") or "")
    result = {**row, "url": safe}
    if stripped or row.get("strippedToken"):
        result["strippedToken"] = True
    return result


def render_repo_list(repositories: list[dict[str, str]]) -> str:
    lines = ["# 拉仓过程记录。拉齐后删除，不进项目配置。"]
    for row in repositories:
        alias = row.get("alias") or row.get("path") or ""
        url = _safe_repo(row)["url"]
        if not url:
            continue
        line = f"{alias}={url}" if alias else url
        branch = (row.get("branch") or "").strip()
        if branch and branch != "main":
            line += f" @{branch}"
        lines.append(line)
    return "\n".join(lines) + "\n"


def manifest_path(workspace_dir: str | Path) -> Path:
    return Path(workspace_dir).resolve() / MANIFEST_NAME


def slug_alias(value: str | None, fallback: str) -> str:
    raw = (value or "").strip() or fallback
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-")
    return slug or fallback


def normalize_repos(data: Any) -> list[dict[str, str]]:
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict) and isinstance(data.get("repositories"), list):
        rows = data["repositories"]
    elif isinstance(data, dict) and isinstance(data.get("repositories"), dict):
        rows = [
            {
                "alias": alias,
                "url": spec.get("url") or spec.get("repo") or "",
                "path": spec.get("path") or alias,
                "branch": spec.get("branch") or spec.get("baseBranch") or "",
            }
            for alias, spec in data["repositories"].items()
        ]
    elif isinstance(data, str):
        return parse_repo_list(data)
    else:
        raise WorkspaceError("清单须是 别名=地址 文本，或旧版 {repositories:...}")
    out = []
    for index, row in enumerate(rows):
        alias = slug_alias(row.get("alias") or row.get("name"), f"repo{index + 1}")
        out.append(
            {
                "alias": alias,
                "url": str(row.get("url") or row.get("repo") or "").strip(),
                "path": str(row.get("path") or alias).strip() or alias,
                "branch": str(row.get("branch") or row.get("baseBranch") or "").strip(),
            }
        )
    return out


def workspace_document(*, name: str = "", repositories: list[dict[str, str]] | None = None) -> str:
    del name  # 过程记录不需要工作区名
    return render_repo_list(normalize_repos({"repositories": repositories or []}))


def merge_repositories(existing: list[dict[str, str]], incoming: list[dict[str, str]]) -> list[dict[str, str]]:
    merged: dict[str, dict[str, str]] = {row["alias"]: dict(row) for row in existing}
    for row in incoming:
        alias = row.get("alias") or ""
        prev = merged.get(alias) or {
            "alias": alias,
            "url": "",
            "path": alias,
            "branch": "",
        }
        merged[alias] = {
            "alias": alias,
            "url": row.get("url") or prev["url"],
            "path": row.get("path") or prev["path"] or alias,
            "branch": row.get("branch") or prev["branch"],
        }
    return list(merged.values())


def read_manifest(workspace_dir: str | Path) -> list[dict[str, str]]:
    workspace = Path(workspace_dir).resolve()
    dest = workspace / MANIFEST_NAME
    legacy = workspace / LEGACY_JSON_NAME
    if dest.exists():
        rows = parse_repo_list(dest.read_text(encoding="utf-8"))
        safe = [_safe_repo(row) for row in rows]
        if any(row.get("strippedToken") for row in safe):
            dest.write_text(render_repo_list(safe), encoding="utf-8")
        return safe
    if legacy.exists():
        rows = normalize_repos(json.loads(legacy.read_text(encoding="utf-8")))
        safe = [_safe_repo(row) for row in rows]
        if any(row.get("strippedToken") for row in safe):
            dest.write_text(render_repo_list(safe), encoding="utf-8")
            legacy.unlink()
        return safe
    return []


def write_workspace_file(workspace_dir: str | Path, *, name: str = "", repositories: list[dict[str, str]] | None = None) -> dict[str, Any]:
    workspace = Path(workspace_dir).resolve()
    workspace.mkdir(parents=True, exist_ok=True)
    dest = workspace / MANIFEST_NAME
    existing = read_manifest(workspace)
    incoming = normalize_repos({"repositories": repositories or []})
    merged = [_safe_repo(row) for row in merge_repositories(existing, incoming)]
    missing = [row["alias"] for row in merged if not row["url"]]
    if missing:
        raise WorkspaceError(f"缺 git 地址，未写入：{', '.join(missing)}")
    if not merged:
        raise WorkspaceError("至少一仓，带 url")
    dest.write_text(workspace_document(name=name, repositories=merged), encoding="utf-8")
    legacy = workspace / LEGACY_JSON_NAME
    if legacy.exists():
        legacy.unlink()
    return {"dest": str(dest), "repositories": merged}


def discard_manifest_if_complete(workspace_dir: str | Path) -> bool:
    """清单里的仓都已在盘上：删掉过程记录，不进项目配置。"""
    if pending_clones(workspace_dir):
        return False
    workspace = Path(workspace_dir).resolve()
    removed = False
    for name in (MANIFEST_NAME, LEGACY_JSON_NAME):
        dest = workspace / name
        if dest.exists():
            dest.unlink()
            removed = True
    return removed


def is_git_root(dir_path: str | Path) -> bool:
    git_path = Path(dir_path) / ".git"
    if not git_path.exists():
        return False
    if git_path.is_dir():
        return True
    if git_path.is_file():
        return bool(re.search(r"^gitdir:", git_path.read_text(encoding="utf-8"), re.M))
    return False


def _list_visible(dir_path: Path) -> list[str]:
    if not dir_path.exists():
        return []
    return [name for name in os.listdir(dir_path) if name != ".DS_Store"]


def pending_clones(workspace_dir: str | Path) -> list[dict[str, str]]:
    """过程清单里有、磁盘上还不是 git 根的仓。ensure 靠它决定要不要再 clone。"""
    workspace = Path(workspace_dir).resolve()
    specs = read_manifest(workspace)
    if not specs:
        return []
    pending = []
    for spec in specs:
        rel = spec.get("path") or spec["alias"]
        target = workspace if rel in ("", ".") else workspace / rel
        if not is_git_root(target):
            pending.append(spec)
    return pending


def inspect_workspace(workspace_dir: str | Path) -> dict[str, Any]:
    workspace = Path(workspace_dir).resolve()
    exists = workspace.exists()
    entries = _list_visible(workspace) if exists else []
    return {
        "workspace": str(workspace),
        "exists": exists,
        "empty": (not exists) or len(entries) == 0,
        "git": is_git_root(workspace),
        "entries": entries,
    }


def clone_target(workspace: Path, subdir: str | None) -> Path:
    if not subdir:
        return workspace
    parts = Path(subdir).parts
    if Path(subdir).is_absolute() or ".." in parts:
        raise WorkspaceError(f"--dir 只能是工作区下的相对目录：{subdir}")
    return workspace / subdir


def _run_git(args: list[str]) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(args)


def git_clone(repo: str, target: Path, branch: str = "", *, run_git: RunGit = _run_git) -> dict[str, Any]:
    from code_wiki.proc import clone_url_for_git

    target.parent.mkdir(parents=True, exist_ok=True)
    safe_url, stripped = clone_url_for_git(repo)
    args = ["git", "clone", "--depth", "1"]
    if branch:
        args.extend(["--branch", branch, "--single-branch"])
    args.extend([safe_url, str(target)])
    result = run_git(args)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        err = re.sub(r"(https?://)[^\s/@]+@", r"\1[REDACTED]@", err, flags=re.I)
        raise WorkspaceError(f"git clone 失败\n{err}".strip())
    return {"url": safe_url, "strippedToken": stripped}


def prepare_workspace(
    workspace_dir: str | Path,
    *,
    repo: str = "",
    branch: str = "",
    dir: str = "",
    repos: list[dict[str, str]] | None = None,
    repos_file: str | Path | None = None,
    dry_run: bool = False,
    run_git: RunGit = _run_git,
) -> dict[str, Any]:
    inspect = inspect_workspace(workspace_dir)
    workspace = Path(inspect["workspace"])
    specs = repos
    if specs is None and repos_file:
        raw = Path(repos_file).read_text(encoding="utf-8")
        stripped = raw.lstrip()
        if stripped.startswith("{") or stripped.startswith("["):
            specs = normalize_repos(json.loads(raw))
        else:
            specs = parse_repo_list(raw)
    if specs:
        specs = [_safe_repo(spec) for spec in specs]
        if repos_file and Path(repos_file).name == MANIFEST_NAME and any(row.get("strippedToken") for row in specs):
            Path(repos_file).write_text(render_repo_list(specs), encoding="utf-8")
        workspace.mkdir(parents=True, exist_ok=True)
        cloned = []
        for spec in specs:
            target = clone_target(workspace, spec.get("path") or spec.get("alias"))
            if is_git_root(target):
                cloned.append({**spec, "action": "skipped-existing-git", "target": str(target), "git": True})
                continue
            if target.exists() and _list_visible(target):
                cloned.append({**spec, "action": "skipped-nonempty", "target": str(target), "git": False})
                continue
            if not spec.get("url"):
                cloned.append({**spec, "action": "need-repo", "target": str(target), "git": False})
                continue
            if dry_run:
                cloned.append({**spec, "action": "dry-run", "target": str(target), "git": False})
                continue
            try:
                cloned_info = git_clone(spec["url"], target, spec.get("branch") or "", run_git=run_git)
            except WorkspaceError as exc:
                # 单个仓失败只记该仓并继续，认证问题常常只影响一个 provider。
                if not is_git_root(target):
                    shutil.rmtree(target, ignore_errors=True)
                cloned.append({**spec, "action": "failed", "target": str(target), "git": False, "error": str(exc)})
                continue
            row = {**spec, "action": "cloned", "target": str(target), "git": is_git_root(target), "url": cloned_info["url"]}
            if spec.get("strippedToken") or cloned_info["strippedToken"]:
                row["strippedToken"] = True
                row["note"] = "清单里的口令已剥掉。到 PAT 页吊销旧 Token，改用凭据管理器。"
            cloned.append(row)
        need = [row for row in cloned if row["action"] == "need-repo"]
        done = [row for row in cloned if row["action"] != "need-repo"]
        return {
            "action": "need-repo" if need and not done else "multi",
            "workspace": str(workspace),
            "git": inspect["git"],
            "repos": cloned,
        }
    if inspect["git"]:
        return {"action": "skipped-existing-git", **inspect, "target": inspect["workspace"]}
    if not inspect["empty"]:
        return {"action": "skipped-nonempty", **inspect, "target": inspect["workspace"]}
    if not repo:
        return {"action": "need-repo", **inspect, "target": inspect["workspace"]}
    target = clone_target(workspace, dir)
    if target.exists() and _list_visible(target):
        raise WorkspaceError(f"clone 目标已有文件：{target}")
    cloned_info = git_clone(repo, target, branch, run_git=run_git)
    return {
        "action": "cloned",
        "strippedToken": cloned_info["strippedToken"],
        "workspace": inspect["workspace"],
        "target": str(target),
        "repo": cloned_info["url"],
        "branch": branch or "",
        "git": is_git_root(target),
    }

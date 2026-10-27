"""按 git 根分仓。不用 Unix find。"""

from __future__ import annotations

from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".venv", ".codegraph"}


def is_git_dir(entry: Path) -> bool:
    if not entry.exists():
        return False
    if entry.is_dir():
        return True
    if entry.is_file():
        try:
            return "gitdir:" in entry.read_text(encoding="utf-8")
        except OSError:
            return False
    return False


def discover_repos(project_root: str | Path, *, max_depth: int = 3) -> list[dict[str, str]]:
    root = Path(project_root).resolve()
    found: list[dict[str, str]] = []

    def consider(abs_path: Path, alias: str, rel: str) -> None:
        git_path = abs_path / ".git"
        if git_path.exists() and is_git_dir(git_path):
            found.append({"alias": alias, "path": rel, "absPath": str(abs_path)})

    consider(root, root.name, ".")

    def walk(dir_path: Path, depth: int) -> None:
        if depth > max_depth:
            return
        try:
            entries = list(dir_path.iterdir())
        except OSError:
            return
        for entry in entries:
            if not entry.is_dir():
                continue
            if entry.name in SKIP_DIRS:
                continue
            rel = str(entry.relative_to(root)) or "."
            consider(entry, entry.name, rel)
            walk(entry, depth + 1)

    walk(root, 1)
    seen: set[str] = set()
    unique = []
    for item in sorted(found, key=lambda row: row["alias"]):
        if item["absPath"] in seen:
            continue
        seen.add(item["absPath"])
        unique.append(item)
    return unique

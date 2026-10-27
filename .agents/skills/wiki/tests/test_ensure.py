from pathlib import Path

import pytest

from code_wiki.cli import main
from code_wiki.init import ensure


def _git_repo(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").mkdir()
    (path / "README.md").write_text(path.name, encoding="utf-8")
    return path


def test_ensure_empty_asks_repos(tmp_path: Path) -> None:
    result = ensure(tmp_path)
    assert result["next"] == "ask-repos"
    assert result["repos"] == []
    assert result["agents"]["has_charter"] is False
    assert "别名=地址" in result["message"]
    assert "丢清单" in result["message"]


def test_ensure_cli_empty_exits_2(tmp_path: Path, capsys) -> None:
    code = main(["ensure", str(tmp_path)])
    assert code == 2
    err = capsys.readouterr().err
    assert "git" in err.lower() or "地址" in err


def test_bare_path_requires_explicit_command(tmp_path: Path) -> None:
    with pytest.raises(SystemExit) as exc:
        main([str(tmp_path)])
    assert exc.value.code == 2
    assert list(tmp_path.iterdir()) == []


def test_ensure_git_without_agents_writes_charter(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    result = ensure(
        tmp_path,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=lambda argv, **kw: type("R", (), {"returncode": 0, "stdout": "aaa\n", "stderr": ""})(),
    )
    assert result["next"] == "ready"
    assert result["agents"]["has_charter"] is True
    text = Path(result["agents"]["path"]).read_text(encoding="utf-8")
    assert "$wiki query" in text
    assert "$wiki refresh" in text
    assert (tmp_path / "docs/project-wiki/code-wiki-repos.json").exists()


def test_ensure_with_charter_only_refreshes(tmp_path: Path) -> None:
    repo = _git_repo(tmp_path / "backend")
    (tmp_path / "AGENTS.md").write_text(
        "<!-- BEGIN code-wiki:prompt -->\nSTOP.\n<!-- END code-wiki:prompt -->\n"
        "<!-- BEGIN code-wiki:knowledge -->\nk\n<!-- END code-wiki:knowledge -->\n",
        encoding="utf-8",
    )
    dest = tmp_path / "docs/project-wiki"
    dest.mkdir(parents=True)
    (dest / "code-wiki-repos.json").write_text("{}", encoding="utf-8")
    meta = repo / ".codegraph"
    meta.mkdir()
    calls = []

    def run(argv, **kw):
        calls.append(argv)
        if "rev-parse" in argv:
            return type("R", (), {"returncode": 0, "stdout": "aaa\n", "stderr": ""})()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    result = ensure(
        tmp_path,
        which_fn=lambda cmd, path=None: "/bin/codegraph" if cmd == "codegraph" else None,
        run_cmd=run,
    )
    assert result["next"] == "ready"
    assert result["graphs"] is None
    # 已有图：refresh 只做增量对账，不重建
    assert result["refresh"]["updated"] == ["backend"]
    assert any(argv[:2] == ["codegraph", "sync"] for argv in calls)
    assert not any(argv[:2] == ["codegraph", "init"] for argv in calls)


def test_ensure_retries_failed_clone_when_sibling_repo_exists(tmp_path: Path) -> None:
    """一仓已在、清单里另一仓还没拉：ensure 必须去 clone 失败仓，不能因为发现了 git 根就 next=ready。"""
    _git_repo(tmp_path / "frontend")
    (tmp_path / "repos.txt").write_text(
        "frontend=/origin/fe\nbackend=/origin/be\n",
        encoding="utf-8",
    )
    git_calls = []

    def fake_git(args):
        git_calls.append(args)
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    result = ensure(
        tmp_path,
        run_git=fake_git,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=lambda argv, **kw: type("R", (), {"returncode": 0, "stdout": "aaa\n", "stderr": ""})(),
    )
    assert any(args[0] == "git" and args[1] == "clone" for args in git_calls)
    cloned_targets = [Path(args[-1]).name for args in git_calls if args and args[0] == "git"]
    assert "backend" in cloned_targets
    assert (tmp_path / "backend" / ".git").is_dir()
    assert result["next"] == "ready"
    aliases = {row["alias"] for row in result["repos"]}
    assert aliases >= {"frontend", "backend"}

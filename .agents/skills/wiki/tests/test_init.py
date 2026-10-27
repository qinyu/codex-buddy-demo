import json
from pathlib import Path

import pytest

from code_wiki.charter import apply_gitignore, write_charter
from code_wiki.discover import discover_repos
from code_wiki.init import InitError, forbidden, init_graphs, plan_commands, refresh_graphs
from code_wiki.diagnose import diagnose_repo, diagnose_workspace


def _git_repo(path: Path, alias: str | None = None) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").mkdir()
    (path / "README.md").write_text(alias or path.name, encoding="utf-8")
    return path


def test_discover_lists_nested_git_not_workspace_root(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    _git_repo(tmp_path / "frontend")
    repos = discover_repos(tmp_path)
    assert [r["alias"] for r in repos] == ["backend", "frontend"]
    assert all(r["path"] != "." for r in repos)


def test_discover_includes_workspace_if_it_is_git(tmp_path: Path) -> None:
    _git_repo(tmp_path)
    repos = discover_repos(tmp_path)
    assert repos[0]["path"] == "."


def test_plan_commands_is_one_codegraph_init_per_repo(tmp_path: Path) -> None:
    be = {"alias": "be", "absPath": str(tmp_path / "be"), "path": "be"}
    fe = {"alias": "fe", "absPath": str(tmp_path / "fe"), "path": "fe"}
    cmds = plan_commands([be, fe])
    assert len(cmds) == 2
    assert all(c["argv"][:2] == ["codegraph", "init"] for c in cmds)
    # 一步建库：不再有 register / build / embed / graphify
    joined = " ".join(" ".join(c["argv"]) for c in cmds)
    for gone in ("register", "build", "embed", "graphify"):
        assert gone not in joined


def test_forbidden_blocks_global_and_destructive_calls() -> None:
    assert forbidden(["codegraph", "install"])
    assert forbidden(["codegraph", "uninstall"])
    assert forbidden(["codegraph", "uninit"])
    # 非交互安装与建库放行
    assert forbidden(["codegraph", "install", "--yes"]) is None
    assert forbidden(["codegraph", "init", "/tmp/repo"]) is None
    assert forbidden(["codegraph", "sync", "/tmp/repo"]) is None


def test_init_graphs_dry_run_and_charter(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    _git_repo(tmp_path / "frontend")
    result = init_graphs(
        tmp_path,
        dry_run=True,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=lambda argv, **kw: type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})(),
        now="2026-01-01T00:00:00+00:00",
    )
    assert len(result["repos"]) == 2
    assert (tmp_path / "docs/project-wiki/code-wiki-repos.json").exists()
    assert result["charter"] is None
    live = init_graphs(
        tmp_path,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=lambda argv, **kw: type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})(),
        now="2026-01-01T00:00:00+00:00",
    )
    text = Path(live["charter"]).read_text(encoding="utf-8")
    assert "STOP." in text
    assert "$wiki query" in text
    assert "$wiki refresh" in text
    assert "code-wiki:prompt" in text
    assert "code-wiki:knowledge" in text
    assert "$wiki query --kind cite|impact" in text
    assert "$code-wiki query" not in text
    assert "$code-wiki refresh" not in text
    assert "codegraph query / callers / callees / impact" not in text
    assert "用哪套" in text
    assert "codegraph" in text
    assert "分仓" in text
    assert "product-workflow charter" in text
    ignore = Path(tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert "# code-wiki:gitignore:start" in ignore
    assert ".codegraph/" in ignore


def test_init_disables_telemetry_before_graph_and_stops_if_it_fails(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    calls = []

    def run(argv, **kw):
        calls.append(argv)
        status = 1 if argv[:3] == ["codegraph", "telemetry", "off"] else 0
        return type("R", (), {"returncode": status, "stdout": "", "stderr": "telemetry failed" if status else ""})()

    with pytest.raises(InitError):
        init_graphs(tmp_path, which_fn=lambda cmd, path=None: "/bin/codegraph", run_cmd=run)
    assert calls == [["codegraph", "telemetry", "off"]]


def test_init_missing_cli_prints_hint(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    with pytest.raises(InitError) as exc:
        init_graphs(tmp_path, which_fn=lambda cmd, path=None: None)
    assert exc.value.code == 2
    assert "colbymchenry/codegraph" in str(exc.value)


def test_allow_install_is_ignored(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")
    result = init_graphs(
        tmp_path,
        allow_install=True,
        which_fn=lambda cmd, path=None: "/bin/codegraph" if cmd == "codegraph" else None,
        run_cmd=lambda argv, **kw: type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})(),
    )
    assert any("交给人" in note for note in result["notes"])
    # 接 agent 只打印不代跑
    assert any("codegraph install --yes" in note for note in result["notes"])


def test_init_failure_stops_and_does_not_degrade(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")

    def run(argv, **kw):
        return type("R", (), {"returncode": 1, "stdout": "", "stderr": "boom"})()

    with pytest.raises(InitError) as exc:
        init_graphs(
            tmp_path,
            which_fn=lambda cmd, path=None: "/bin/codegraph",
            run_cmd=run,
        )
    assert exc.value.code == 1
    assert "boom" in str(exc.value)


def test_gitignore_keeps_user_lines(tmp_path: Path) -> None:
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text("dist/\n", encoding="utf-8")
    apply_gitignore(tmp_path)
    apply_gitignore(tmp_path)
    text = gitignore.read_text(encoding="utf-8")
    assert text.count("# code-wiki:gitignore:start") == 1
    assert text.startswith("dist/")


def test_upsert_does_not_touch_suite_charter(tmp_path: Path) -> None:
    agents = tmp_path / "AGENTS.md"
    agents.write_text(
        "# AGENTS.md\n\n<!-- BEGIN product-workflow charter suite=v0.6.0 -->\nkeep me\n<!-- END product-workflow charter -->\n",
        encoding="utf-8",
    )
    write_charter(agents, knowledge="- 状态：已建", prompt="STOP. query", skeleton=False)
    text = agents.read_text(encoding="utf-8")
    assert "keep me" in text
    assert "STOP." in text
    assert "code-wiki:knowledge" in text


def test_skeleton_caps_under_200_lines(tmp_path: Path) -> None:
    dest = write_charter(tmp_path / "AGENTS.md", knowledge="- k", prompt="STOP.", skeleton=True)
    assert len(dest.read_text(encoding="utf-8").splitlines()) < 200


def _run_with_head(repo: Path, head: str = "bbb", extra_ok: bool = False):
    def run(argv, **kw):
        if "rev-parse" in argv:
            return type("R", (), {"returncode": 0, "stdout": f"{head}\n", "stderr": ""})()
        if extra_ok:
            return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()
        return type("R", (), {"returncode": 1, "stdout": "", "stderr": ""})()

    return run


def test_diagnose_built_when_graph_present_without_recorded_commit(tmp_path: Path) -> None:
    repo = _git_repo(tmp_path / "backend")
    (repo / ".codegraph").mkdir()
    run = _run_with_head(repo)
    report = diagnose_repo({"alias": "backend", "path": "backend", "absPath": str(repo)}, run_cmd=run)
    # CodeGraph 不落 commit：图在即算已建，freshness 交给它的自动同步
    assert report["status"] == "built"
    assert report["graph_present"] is True
    assert report["graph_commit"] is None
    whole = diagnose_workspace(tmp_path, run_cmd=run)
    assert whole["built"] == ["backend"]
    assert whole["fresh"] is True


def test_diagnose_stale_when_recorded_commit_differs(tmp_path: Path) -> None:
    repo = _git_repo(tmp_path / "backend")
    meta = repo / ".codegraph"
    meta.mkdir()
    (meta / "meta.json").write_text(json.dumps({"commit": "aaa"}), encoding="utf-8")
    run = _run_with_head(repo, head="bbb")
    report = diagnose_repo({"alias": "backend", "path": "backend", "absPath": str(repo)}, run_cmd=run)
    assert report["status"] == "stale"
    whole = diagnose_workspace(tmp_path, run_cmd=run)
    assert "backend" in whole["stale"]


def test_diagnose_fresh_when_recorded_commit_matches(tmp_path: Path) -> None:
    repo = _git_repo(tmp_path / "backend")
    meta = repo / ".codegraph"
    meta.mkdir()
    (meta / "meta.json").write_text(json.dumps({"commit": "aaa"}), encoding="utf-8")
    run = _run_with_head(repo, head="aaa")
    report = diagnose_repo({"alias": "backend", "path": "backend", "absPath": str(repo)}, run_cmd=run)
    assert report["status"] == "fresh"


def test_refresh_syncs_repos_that_have_a_graph(tmp_path: Path) -> None:
    repo = _git_repo(tmp_path / "backend")
    (repo / ".codegraph").mkdir()
    calls = []

    def run(argv, **kw):
        calls.append(argv)
        if "rev-parse" in argv:
            return type("R", (), {"returncode": 0, "stdout": "bbb\n", "stderr": ""})()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    refreshed = refresh_graphs(
        tmp_path,
        which_fn=lambda cmd, path=None: "/bin/codegraph",
        run_cmd=run,
    )
    assert refreshed["updated"] == ["backend"]
    assert any(argv[:2] == ["codegraph", "sync"] for argv in calls)
    # 不再有全量重建与 --base 增量参数
    assert not any(argv[:2] == ["codegraph", "init"] for argv in calls)
    assert not any("--base" in argv for argv in calls)


def test_refresh_without_graph_does_not_call_engine(tmp_path: Path) -> None:
    _git_repo(tmp_path / "backend")

    def run(argv, **kw):
        if "rev-parse" in argv:
            return type("R", (), {"returncode": 0, "stdout": "bbb\n", "stderr": ""})()
        raise AssertionError(argv)

    result = refresh_graphs(tmp_path, which_fn=lambda cmd, path=None: None, run_cmd=run)
    assert result["updated"] == []
    assert result["no_graph"] == ["backend"]


def test_no_git_at_workspace_root_is_not_the_only_repo(tmp_path: Path) -> None:
    with pytest.raises(InitError, match="未发现 git 根"):
        init_graphs(tmp_path, which_fn=lambda cmd, path=None: "/bin/x")

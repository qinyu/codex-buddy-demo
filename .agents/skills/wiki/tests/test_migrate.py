import json
from pathlib import Path

import pytest

from code_wiki.migrate import (
    LEGACY_DIR,
    MigrateError,
    detect_legacy,
    migrate,
    migration_report,
)


def _git_repo(path: Path, name: str | None = None) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").mkdir()
    (path / "README.md").write_text(name or path.name, encoding="utf-8")
    return path


def _fake_home(monkeypatch, tmp_path: Path) -> Path:
    home = tmp_path / "home"
    home.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(Path, "home", staticmethod(lambda: home))
    return home


def _seed_legacy(root: Path, repo: Path, *, global_registry: bool = True) -> None:
    legacy = repo / LEGACY_DIR
    legacy.mkdir(parents=True, exist_ok=True)
    (legacy / "meta.json").write_text(json.dumps({"commit": "aaa"}), encoding="utf-8")
    (root / ".gitignore").write_text(
        "# code-wiki:gitignore:start\n.code-review-graph/\ngraphify-out/\n# code-wiki:gitignore:end\n",
        encoding="utf-8",
    )
    (root / "AGENTS.md").write_text(
        "# AGENTS.md\n\n"
        "<!-- BEGIN code-wiki:structure -->\nkeep-structure\n<!-- END code-wiki:structure -->\n\n"
        "<!-- BEGIN code-wiki:knowledge -->\n- 用哪套：crg\n- 怎么查：code-review-graph search X\n"
        "<!-- END code-wiki:knowledge -->\n",
        encoding="utf-8",
    )
    # 与引擎无关的知识资产
    wiki = root / "docs" / "project-wiki"
    (wiki / "glossary").mkdir(parents=True, exist_ok=True)
    (wiki / "glossary" / "be.json").write_text('{"term":"计提"}', encoding="utf-8")
    (wiki / "code-wiki-repos.json").write_text('{"provider":"codegraph","repos":[]}', encoding="utf-8")
    if global_registry:
        reg = Path.home() / LEGACY_DIR
        reg.mkdir(parents=True, exist_ok=True)
        (reg / "registry.json").write_text('{"repos":{}}', encoding="utf-8")


def _ok_run():
    def run(argv, **kw):
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    return run


def test_detect_reports_all_four_sources(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    found = detect_legacy(tmp_path)
    assert found["found"] is True
    assert found["repoGraphs"] == ["backend"]
    assert found["globalRegistry"].endswith("registry.json")
    assert found["gitignoreMentionsLegacy"] is True
    assert found["charterMentionsLegacy"] is True


def test_nothing_to_do_on_clean_workspace(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    _git_repo(tmp_path / "backend")
    report = migration_report(tmp_path)
    assert report["detected"]["found"] is False
    assert report["next"] == "nothing-to-do"
    result = migrate(tmp_path, which_fn=lambda cmd, path=None: "/bin/codegraph", run_cmd=_ok_run())
    assert result["alreadyClean"] is True
    assert result["rebuilt"] == []


def test_plan_does_not_touch_anything(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    report = migration_report(tmp_path)
    assert report["next"] == "confirm-then-run-with-yes"
    assert any(LEGACY_DIR in item for item in report["will_delete"])
    assert any("词表" in item for item in report["will_keep"])
    # 只报告，不动盘
    assert (repo / LEGACY_DIR).is_dir()
    assert (tmp_path / ".gitignore").read_text(encoding="utf-8").count(".code-review-graph/") == 1


def test_unconfirmed_migrate_refuses(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    with pytest.raises(MigrateError) as exc:
        migrate(tmp_path, which_fn=lambda cmd, path=None: "/bin/codegraph", run_cmd=_ok_run())
    assert exc.value.code == 3
    assert (repo / LEGACY_DIR).is_dir()


def test_confirmed_migrate_purges_rebuilds_and_keeps_knowledge(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    calls = []

    def run(argv, **kw):
        calls.append(argv)
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    result = migrate(
        tmp_path,
        confirmed=True,
        which_fn=lambda cmd, path=None: "/bin/codegraph" if cmd == "codegraph" else None,
        run_cmd=run,
    )
    # 旧运行时数据清掉（仓内 + 全局注册表）
    assert not (repo / LEGACY_DIR).exists()
    assert not (Path.home() / LEGACY_DIR).exists()
    # .gitignore 换成 .codegraph/
    ignore = (tmp_path / ".gitignore").read_text(encoding="utf-8")
    assert ".codegraph/" in ignore
    assert "code-review-graph" not in ignore
    assert "graphify-out" not in ignore
    # 章程改写，structure 块不动
    agents = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "keep-structure" in agents
    assert "code-review-graph" not in agents
    assert "codegraph" in agents
    # 知识资产原样（只断言关键内容，不锁格式）
    glossary = (tmp_path / "docs/project-wiki/glossary/be.json").read_text(encoding="utf-8")
    assert "计提" in glossary
    assert (tmp_path / "docs/project-wiki/code-wiki-repos.json").exists()
    # 重建走 codegraph init
    assert result["rebuilt"] == ["backend"]
    assert any(argv[:2] == ["codegraph", "init"] for argv in calls)
    assert "pipx uninstall code-review-graph" in result["note"]


def test_migrate_is_idempotent(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    kwargs = {
        "confirmed": True,
        "which_fn": lambda cmd, path=None: "/bin/codegraph" if cmd == "codegraph" else None,
        "run_cmd": _ok_run(),
    }
    migrate(tmp_path, **kwargs)
    again = migrate(tmp_path, **kwargs)
    assert again["alreadyClean"] is True
    assert again["purged"] is None


def test_purge_completes_even_without_engine(tmp_path: Path, monkeypatch) -> None:
    _fake_home(monkeypatch, tmp_path)
    repo = _git_repo(tmp_path / "backend")
    _seed_legacy(tmp_path, repo)
    result = migrate(
        tmp_path,
        confirmed=True,
        which_fn=lambda cmd, path=None: None,
    )
    # 清除不回滚；缺引擎时把安装段交给人
    assert not (repo / LEGACY_DIR).exists()
    assert result["rebuilt"] == []
    assert result["next"] == "install-then-init"
    assert "colbymchenry/codegraph" in result["hint"]

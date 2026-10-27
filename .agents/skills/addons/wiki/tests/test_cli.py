import json
from pathlib import Path

from code_wiki.cli import main


def test_init_writes_json(tmp_path: Path) -> None:
    code = main(
        [
            "init",
            str(tmp_path),
            "--alias",
            "backend",
            "--url",
            "https://git.example/be.git",
            "--dry-run",
        ]
    )
    assert code == 0
    text = (tmp_path / "repos.txt").read_text(encoding="utf-8")
    assert "backend=https://git.example/be.git" in text


def test_init_two_repos_json(tmp_path: Path) -> None:
    code = main(
        [
            "init",
            str(tmp_path),
            "--alias",
            "backend",
            "--url",
            "https://git.example/be.git",
            "--alias",
            "frontend",
            "--url",
            "https://git.example/fe.git",
            "--dry-run",
        ]
    )
    assert code == 0
    text = (tmp_path / "repos.txt").read_text(encoding="utf-8")
    assert "backend=https://git.example/be.git" in text
    assert "frontend=https://git.example/fe.git" in text


def test_init_rejects_missing_url(tmp_path: Path) -> None:
    code = main(["init", str(tmp_path), "--alias", "backend"])
    assert code == 2
    assert not (tmp_path / "repos.txt").exists()
    assert not (tmp_path / "workspace.json").exists()


def test_query_cli_engine_json(tmp_path: Path, capsys) -> None:
    engine = tmp_path / "engine.json"
    engine.write_text(
        json.dumps({"results": [{"name": "Login", "file_path": "a.vue", "line_start": 3}]}),
        encoding="utf-8",
    )
    code = main(
        [
            "query",
            "--repo",
            str(tmp_path),
            "--question",
            "登录",
            "--engine-json",
            str(engine),
            "--alias",
            "frontend",
        ]
    )
    assert code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["hits"][0]["from_graph"] is True
    assert out["kind"] == "search"


def test_query_cite_kind(tmp_path: Path, capsys) -> None:
    engine = tmp_path / "engine.json"
    engine.write_text(
        json.dumps({"results": [{"name": "Login", "file_path": "a.vue", "line_start": 3}]}),
        encoding="utf-8",
    )
    code = main(
        [
            "query",
            "--repo",
            str(tmp_path),
            "--symbol",
            "Login",
            "--kind",
            "cite",
            "--engine-json",
            str(engine),
            "--alias",
            "frontend",
        ]
    )
    assert code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["cite"] == "frontend:a.vue:3"
    assert out["kind"] == "cite"


def test_query_impact_kind(tmp_path: Path, capsys) -> None:
    engine = tmp_path / "engine.json"
    engine.write_text(
        json.dumps({"callers": [{"name": "OrderService", "file_path": "src/O.cs", "line_start": 8}]}),
        encoding="utf-8",
    )
    code = main(
        [
            "query",
            "--repo",
            str(tmp_path),
            "--symbol",
            "AccrueApiService",
            "--kind",
            "impact",
            "--engine-json",
            str(engine),
            "--alias",
            "backend",
        ]
    )
    assert code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["kind"] == "impact"
    assert out["hits"][0]["from_graph"] is True


def test_wiki_grill_then_confirm_cli(tmp_path: Path, capsys) -> None:
    from code_wiki.wiki import scaffold_module_map

    modules = [
        {"id": "M1", "name": "订单", "duty": "下单", "seam": "OrderApi", "hint": "src/Order"},
    ]
    seams = [{"from": "订单", "to": "计价", "rule": "只经 PricingApi", "state": "ok"}]
    scaffold_module_map(tmp_path, modules=modules, seams=seams)
    assert main(["wiki", "grill", str(tmp_path)]) == 0
    grill = json.loads(capsys.readouterr().out)
    assert grill["ready"] is True
    assert main(["wiki", "confirm", str(tmp_path), "--by", "张三"]) == 0
    confirmed = json.loads(capsys.readouterr().out)
    assert confirmed["status"] == "confirmed"
    assert confirmed["confirmed_by"] == "张三"


def test_onboard_cli_ask_permission_exits_3(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(
        "code_wiki.cli.onboard",
        lambda *a, **k: {
            "next": "ask-permission",
            "ask": {"kind": "ask-permission", "ask": "需要许可"},
            "steps": [],
            "workspace": str(tmp_path),
        },
    )
    code = main(["onboard", str(tmp_path)])
    assert code == 3


def test_onboard_cli_retry_graph_exits_4(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(
        "code_wiki.cli.onboard",
        lambda *a, **k: {
            "next": "retry-graph",
            "steps": [{"id": "graph", "state": "failed"}],
            "workspace": str(tmp_path),
        },
    )
    code = main(["onboard", str(tmp_path)])
    assert code == 4


def test_wiki_confirm_cli_blocked_when_frontier_open(tmp_path: Path, capsys) -> None:
    from code_wiki.wiki import scaffold_module_map

    scaffold_module_map(
        tmp_path,
        modules=[{
            "id": "M1",
            "name": "src",
            "duty": "（待 agent 按 codebase-design 词表补：这是什么 module）",
            "seam": "（待补对外 seam 名）",
            "hint": "src",
        }],
        seams=[],
    )
    code = main(["wiki", "confirm", str(tmp_path), "--by", "张三"])
    assert code == 3
    err = capsys.readouterr().err
    assert "前沿" in err

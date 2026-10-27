import json
from pathlib import Path

from code_wiki.graph import cite_symbol, impact_of, query_with_graph


def test_query_marks_from_graph_only_from_engine_json(tmp_path: Path) -> None:
    glossary = tmp_path / "g.json"
    glossary.write_text(
        json.dumps({"entries": [{"term": "计提", "symbols": ["AccrueApiService"]}]}),
        encoding="utf-8",
    )
    engine = json.dumps(
        {"results": [{"name": "AccrueApiService", "file_path": "src/A.cs", "line_start": 10}]}
    )
    result = query_with_graph(
        question="促销费用计提",
        glossary_path=str(glossary),
        repo_abs=str(tmp_path / "backend"),
        alias="backend",
        wiki_ref="docs/wiki/accrue.md",
        engine_text=engine,
        which_fn=lambda cmd, path=None: None,
    )
    assert result["status"] == 0
    assert result["hits"][0]["from_graph"] is True
    assert result["hits"][0]["confidence"] == "verified"
    assert result["hits"][0]["path"] == "src/A.cs"
    assert result["hits"][0]["wiki_ref"] == "docs/wiki/accrue.md"


def test_missing_cli_does_not_invent_from_graph() -> None:
    result = query_with_graph(
        question="计提",
        repo_abs="/tmp/be",
        which_fn=lambda cmd, path=None: None,
    )
    assert result["status"] == 2
    assert result["error"] == "missing-cli"
    assert "hits" not in result or not result.get("hits")
    assert "colbymchenry/codegraph" in result["stderr"]


def test_cite_returns_repo_path_line() -> None:
    engine = json.dumps({"results": [{"name": "Login", "file_path": "pages/Login.vue", "line_start": 42}]})
    result = cite_symbol(symbol="Login", repo_abs="/tmp/fe", alias="frontend", engine_text=engine)
    assert result["cite"] == "frontend:pages/Login.vue:42"


def test_impact_uses_engine_edges_not_comment_strings() -> None:
    engine = {
        "callers": [
            {"name": "OrderService", "file_path": "src/OrderService.cs", "line_start": 8, "kind": "caller"},
        ]
    }
    result = impact_of(symbol="AccrueApiService", repo_abs="/tmp/be", alias="backend", engine_json=engine)
    assert result["hits"][0]["from_graph"] is True
    assert result["hits"][0]["path"] == "src/OrderService.cs"
    assert result["hits"][0]["repo"] == "backend"

import json
from pathlib import Path

import pytest

from code_wiki.query import classify_hit, load_glossary, match_glossary, parse_engine_output, rank_hits


def test_glossary_self_match_is_not_verified() -> None:
    hit = {"symbol": "AccrueApiService", "from_graph": False}
    matches = [{"term": "促销费用计提", "symbols": ["AccrueApiService"]}]
    assert classify_hit(hit, matches) == "unknown"


def test_self_reported_from_graph_without_pointer_is_unknown() -> None:
    hit = {"symbol": "AccrueApiService", "from_graph": True, "path": "", "line": ""}
    matches = [{"symbols": ["AccrueApiService"]}]
    assert classify_hit(hit, matches) == "unknown"


def test_engine_pointer_and_glossary_is_verified() -> None:
    hit = {
        "symbol": "AccrueApiService",
        "from_graph": True,
        "path": "src/AccrueApiService.cs",
        "line": 12,
    }
    matches = [{"symbols": ["AccrueApiService"]}]
    assert classify_hit(hit, matches) == "verified"


def test_engine_pointer_without_glossary_is_inferred() -> None:
    hit = {"symbol": "Foo", "from_graph": True, "path": "a.cs", "line": 1}
    assert classify_hit(hit, []) == "inferred"


def test_rank_drops_self_reported_from_graph() -> None:
    hits = [
        {
            "symbol": "AccrueApiService",
            "from_graph": True,
            "path": "src/A.cs",
            "line": 10,
        }
    ]
    matches = [{"symbols": ["AccrueApiService"]}]
    ranked = rank_hits(hits=hits, glossary_matches=matches, trust_from_graph=False)
    assert ranked["hits"][0]["from_graph"] is False
    assert ranked["hits"][0]["confidence"] == "inferred"


def test_rank_caps_at_five() -> None:
    hits = [
        {"symbol": f"S{i}", "from_graph": True, "path": f"f{i}.cs", "line": i, "repo": "be"}
        for i in range(8)
    ]
    ranked = rank_hits(hits=hits, limit=5)
    assert len(ranked["hits"]) == 5
    assert ranked["truncated"] is True
    assert len(ranked["uncovered"]) == 3


def test_parse_engine_json_only() -> None:
    text = json.dumps(
        {
            "results": [
                {"name": "AccrueApiService", "file_path": "src/A.cs", "line_start": 10},
                {"name": "skip-me", "file_path": "", "line_start": 1},
            ]
        }
    )
    hits = parse_engine_output(text)
    assert hits == [
        {
            "symbol": "AccrueApiService",
            "path": "src/A.cs",
            "line": 10,
            "kind": "",
            "score": None,
            "from_graph": True,
        }
    ]


def test_parse_engine_rejects_prose() -> None:
    with pytest.raises(ValueError, match="须是 JSON"):
        parse_engine_output("我觉得实现在 AccrueApiService")


def test_match_glossary_by_alias(tmp_path: Path) -> None:
    path = tmp_path / "g.json"
    path.write_text(
        json.dumps(
            {
                "entries": [
                    {
                        "term": "促销费用计提",
                        "aliases": ["计提"],
                        "symbols": ["AccrueApiService"],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    hits = match_glossary(load_glossary(path), "经销商要看计提")
    assert hits[0]["symbols"] == ["AccrueApiService"]


# --- CodeGraph JSON 形状未实测：只保证宽容取值 + 认不出时报错 ---


def test_parse_accepts_bare_list_shape() -> None:
    text = json.dumps([{"name": "Login", "file_path": "a/Login.vue", "line_start": 42}])
    hits = parse_engine_output(text)
    assert hits[0]["symbol"] == "Login"
    assert hits[0]["path"] == "a/Login.vue"
    assert hits[0]["line"] == 42
    assert hits[0]["from_graph"] is True


def test_parse_accepts_symbols_key_and_alternate_fields() -> None:
    text = json.dumps({"symbols": [{"symbol": "Accrue", "file": "src/A.cs", "start_line": 7, "type": "method"}]})
    hits = parse_engine_output(text)
    assert hits[0]["path"] == "src/A.cs"
    assert hits[0]["line"] == 7
    assert hits[0]["kind"] == "method"


def test_parse_raises_when_shape_unrecognized() -> None:
    # 有结果但认不出字段：必须报错，不能静默当“没找到”
    text = json.dumps({"results": [{"unexpected": "shape"}]})
    with pytest.raises(ValueError, match="认不出字段"):
        parse_engine_output(text)


def test_parse_raises_when_no_result_container() -> None:
    with pytest.raises(ValueError, match="找不到结果数组"):
        parse_engine_output(json.dumps({"meta": {"count": 0}}))

"""词表匹配 + 命中分级。from_graph 由引擎 JSON 标上。"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULT_LIMIT = 5
RANK = {"verified": 0, "inferred": 1, "unknown": 2}


def normalize(text: str | None) -> str:
    return "".join(str(text or "").lower().split())


def load_glossary(file: str | Path) -> list[dict[str, Any]]:
    raw = json.loads(Path(file).read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict) and isinstance(raw.get("entries"), list):
        return raw["entries"]
    raise ValueError("词表须是数组，或 {entries:[]}")


def match_glossary(entries: list[dict[str, Any]], question: str) -> list[dict[str, Any]]:
    q = normalize(question)
    if not q:
        return []
    hits = []
    for entry in entries:
        needles = [normalize(entry.get("term")), *[normalize(a) for a in entry.get("aliases") or []]]
        if any(n and (n in q or q in n) for n in needles):
            hits.append(
                {
                    "term": entry.get("term"),
                    "aliases": entry.get("aliases") or [],
                    "symbols": entry.get("symbols") or [],
                    "source_file": entry.get("source_file") or "",
                }
            )
    return hits


def symbol_key(hit: dict[str, Any]) -> str:
    return str(hit.get("symbol") or hit.get("name") or "").strip()


def has_graph_pointer(hit: dict[str, Any]) -> bool:
    path_value = str(hit.get("path") or "").strip()
    line = hit.get("line")
    return bool(path_value) and line not in (None, "")


def classify_hit(hit: dict[str, Any], glossary_matches: list[dict[str, Any]]) -> str:
    symbol = symbol_key(hit)
    glossary_symbols = {str(s) for item in glossary_matches for s in (item.get("symbols") or [])}
    from_graph = bool(hit.get("from_graph")) and has_graph_pointer(hit)
    if symbol and symbol in glossary_symbols and from_graph:
        return "verified"
    if has_graph_pointer(hit):
        return "inferred"
    return "unknown"


def rank_hits(
    *,
    hits: list[dict[str, Any]] | None = None,
    glossary_matches: list[dict[str, Any]] | None = None,
    wiki_ref: str = "",
    repo: str = "",
    limit: int = DEFAULT_LIMIT,
    trust_from_graph: bool = False,
) -> dict[str, Any]:
    cap = int(limit) if int(limit) > 0 else DEFAULT_LIMIT
    prepared = []
    for hit in hits or []:
        cleaned = dict(hit)
        if not trust_from_graph:
            cleaned.pop("from_graph", None)
        prepared.append(
            {
                "repo": cleaned.get("repo") or repo or "",
                "symbol": symbol_key(cleaned),
                "path": cleaned.get("path") or "",
                "line": cleaned.get("line") if cleaned.get("line") not in (None,) else "",
                "confidence": classify_hit(cleaned, glossary_matches or []),
                "from_graph": bool(cleaned.get("from_graph")),
                "wiki_ref": cleaned.get("wiki_ref") or wiki_ref or "",
            }
        )
    prepared.sort(key=lambda h: (RANK[h["confidence"]], h["symbol"]))
    kept, rest = prepared[:cap], prepared[cap:]
    uncovered = [
        f"{hit['repo']}:{hit['path']}:{hit['line']}:{hit['symbol']}".lstrip(":")
        for hit in rest
    ]
    return {"hits": kept, "uncovered": uncovered, "truncated": bool(rest), "limit": cap}


def _pick(row: dict[str, Any], names: tuple[str, ...], default: Any = "") -> Any:
    for name in names:
        value = row.get(name)
        if value not in (None, ""):
            return value
    return default


def _unwrap(row: dict[str, Any]) -> dict[str, Any]:
    """CodeGraph 把字段嵌在 node 里（实测 1.6.0）；扁平形状也接受。"""
    node = row.get("node")
    return node if isinstance(node, dict) else row


def parse_engine_output(text: str) -> list[dict[str, Any]]:
    """引擎 JSON → hits。

    已实测（CodeGraph 1.6.0，样本见 `tests/test_codegraph_shape.py`）：
    `query --json` 返回裸数组，每项是 `{node: {name, qualifiedName, filePath,
    startLine, endLine, kind}, score}`。字段嵌在 node 里且为 camelCase。
    扁平与 snake_case 一并接受，容版本漂移；形状完全认不出时报错，不静默返空。
    """
    trimmed = (text or "").strip()
    if not trimmed:
        return []
    brace = trimmed.find("{")
    bracket = trimmed.find("[")
    candidates = [i for i in (brace, bracket) if i >= 0]
    payload = trimmed[min(candidates) :] if candidates else trimmed
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise ValueError("引擎输出须是 JSON") from exc
    rows: Any = data if isinstance(data, list) else None
    if rows is None and isinstance(data, dict):
        for key in ("results", "symbols", "matches", "hits", "items", "data"):
            if isinstance(data.get(key), list):
                rows = data[key]
                break
    if rows is None:
        raise ValueError("引擎输出里找不到结果数组")
    hits = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        row = _unwrap(item)
        hit = {
            "symbol": str(_pick(row, ("name", "qualifiedName", "symbol", "label"))).strip(),
            "path": str(_pick(row, ("filePath", "file_path", "path", "file"))).strip(),
            "line": _pick(row, ("startLine", "line_start", "start_line", "line"), ""),
            "kind": _pick(row, ("kind", "type"), ""),
            "score": item.get("score"),
            "from_graph": True,
        }
        if hit["path"] and hit["line"] not in ("", None):
            hits.append(hit)
    if rows and not hits:
        raise ValueError(
            "引擎返回了结果但认不出字段（需 path 与 line）；"
            "把真实输出补进 tests/test_codegraph_shape.py"
        )
    return hits

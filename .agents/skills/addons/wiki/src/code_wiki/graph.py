"""调图谱引擎。from_graph 只来自引擎 JSON。"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, Callable

from code_wiki.query import (
    DEFAULT_LIMIT,
    load_glossary,
    match_glossary,
    parse_engine_output,
    rank_hits,
)
from code_wiki.tools import format_hint, which

RunCmd = Callable[..., subprocess.CompletedProcess[str]]


def search_argv(query: str, limit: int) -> list[str]:
    """仓内执行；图在 cwd 的 .codegraph/。"""
    return ["codegraph", "query", query, "--json", "--limit", str(limit)]


def queries_from_glossary(question: str, glossary_path: str = "") -> list[str]:
    if not glossary_path:
        return [question] if question else []
    matches = match_glossary(load_glossary(glossary_path), question)
    symbols = list(dict.fromkeys(s for item in matches for s in (item.get("symbols") or []) if s))
    return symbols or ([question] if question else [])


def _run(argv: list[str], cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(argv, cwd=cwd)


def run_in_cwd(
    argv: list[str], cwd: str, run_cmd: RunCmd = _run
) -> subprocess.CompletedProcess[str]:
    """CodeGraph CLI 按当前目录找 .codegraph/，所以查询必须在仓内跑。

    `_run` 收 cwd，生产路径直传。TypeError 回退只给「只收 argv」的测试替身用——
    替身不真执行，丢 cwd 无害。
    """
    try:
        return run_cmd(argv, cwd=cwd)
    except TypeError:
        return run_cmd(argv)


def graph_readiness(
    repo_abs: str, *, cli: str = "", which_fn=which, run_cmd: RunCmd = _run
) -> dict[str, Any]:
    """Fail closed on public status; never inspect index files to diagnose it."""
    if not (cli or which_fn("codegraph")):
        return {"status": 2, "error": "missing-cli", "stderr": format_hint(["codegraph"])}
    argv = ["codegraph", "status", "--json"]
    if cli:
        from code_wiki.proc import wrap_windows_argv
        argv = wrap_windows_argv(argv, cli)
    result = run_in_cwd(argv, repo_abs, run_cmd)
    try:
        state = json.loads(result.stdout or "")
    except (ValueError, TypeError):
        state = None
    if result.returncode != 0 or not isinstance(state, dict) or state.get("initialized") is not True:
        return {
            "status": result.returncode or 1, "error": "graph-unavailable",
            "stderr": result.stderr or result.stdout or "CodeGraph status unavailable",
            "argv": argv, "hits": [],
        }
    return {"status": 0}


def run_engine_search(
    *,
    query: str,
    repo_abs: str,
    limit: int,
    cli: str = "",
    engine_text: str | None = None,
    which_fn=which,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    if engine_text is not None:
        return {"status": 0, "stdout": engine_text, "stderr": "", "argv": ["#engine-json", query]}
    bin_path = cli or which_fn("codegraph")
    if not bin_path:
        return {
            "status": 2,
            "stdout": "",
            "stderr": format_hint(["codegraph"]) + "缺引擎时 hits 为空。\n",
            "argv": [],
        }
    argv = search_argv(query, limit)
    if cli:
        from code_wiki.proc import wrap_windows_argv
        argv = wrap_windows_argv(argv, cli)
    result = run_in_cwd(argv, repo_abs, run_cmd)
    return {
        "status": result.returncode if result.returncode is not None else 1,
        "stdout": result.stdout or "",
        "stderr": result.stderr or "",
        "argv": argv,
    }


def query_with_graph(
    *,
    question: str = "",
    glossary_path: str = "",
    repo_abs: str,
    alias: str = "",
    wiki_ref: str = "",
    limit: int = DEFAULT_LIMIT,
    engine_text: str | None = None,
    cli: str = "",
    which_fn=which,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    if engine_text is None:
        readiness = graph_readiness(repo_abs, cli=cli, which_fn=which_fn, run_cmd=run_cmd)
        if readiness["status"] != 0:
            return readiness
    glossary_matches = (
        match_glossary(load_glossary(glossary_path), question) if glossary_path and question else []
    )
    queries = queries_from_glossary(question, glossary_path)
    engine_hits: list[dict[str, Any]] = []
    searches = []
    for query in queries:
        ran = run_engine_search(
            query=query,
            repo_abs=repo_abs,
            limit=int(limit),
            cli=cli,
            engine_text=engine_text,
            which_fn=which_fn,
            run_cmd=run_cmd,
        )
        searches.append({"query": query, "status": ran["status"], "argv": ran["argv"]})
        if ran["status"] == 2 and engine_text is None:
            return {
                "error": "missing-cli",
                "status": 2,
                "stderr": ran["stderr"],
                "glossaryMatches": glossary_matches,
                "searches": searches,
            }
        if ran["status"] != 0:
            return {
                "error": "search-failed",
                "status": ran["status"] or 1,
                "stderr": ran["stderr"],
                "glossaryMatches": glossary_matches,
                "searches": searches,
            }
        repo_name = alias or Path(repo_abs).name
        for hit in parse_engine_output(ran["stdout"]):
            engine_hits.append({**hit, "repo": repo_name})
    ranked = rank_hits(
        hits=engine_hits,
        glossary_matches=glossary_matches,
        wiki_ref=wiki_ref,
        repo=alias or Path(repo_abs).name,
        limit=int(limit),
        trust_from_graph=True,
    )
    return {"status": 0, "glossaryMatches": glossary_matches, "searches": searches, **ranked}


def lookup(
    *,
    question: str = "",
    symbol: str = "",
    kind: str = "search",
    glossary_path: str = "",
    repo_abs: str,
    alias: str = "",
    wiki_ref: str = "",
    limit: int = DEFAULT_LIMIT,
    engine_text: str | None = None,
    engine_json: dict[str, Any] | None = None,
    cli: str = "",
    which_fn=which,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    mode = kind if kind in {"search", "cite", "impact"} else "search"
    if mode == "impact":
        result = impact_of(
            symbol=symbol or question,
            repo_abs=repo_abs,
            alias=alias,
            engine_json=engine_json,
            which_fn=which_fn,
            run_cmd=run_cmd,
        )
        return {**result, "kind": "impact"}
    if mode == "cite":
        result = cite_symbol(
            symbol=symbol or question,
            repo_abs=repo_abs,
            alias=alias,
            engine_text=engine_text,
            which_fn=which_fn,
            run_cmd=run_cmd,
        )
        return {**result, "kind": "cite"}
    result = query_with_graph(
        question=question or symbol,
        glossary_path=glossary_path,
        repo_abs=repo_abs,
        alias=alias,
        wiki_ref=wiki_ref,
        limit=limit,
        engine_text=engine_text,
        cli=cli,
        which_fn=which_fn,
        run_cmd=run_cmd,
    )
    return {**result, "kind": "search"}


def cite_symbol(
    *,
    symbol: str,
    repo_abs: str,
    alias: str = "",
    engine_text: str | None = None,
    which_fn=which,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    result = query_with_graph(
        question=symbol,
        repo_abs=repo_abs,
        alias=alias,
        limit=1,
        engine_text=engine_text,
        which_fn=which_fn,
        run_cmd=run_cmd,
    )
    hits = result.get("hits") or []
    if hits:
        hit = hits[0]
        return {**result, "cite": f"{hit.get('repo')}:{hit.get('path')}:{hit.get('line')}"}
    return result


def impact_of(
    *,
    symbol: str,
    repo_abs: str,
    alias: str = "",
    engine_json: dict[str, Any] | None = None,
    which_fn=which,
    run_cmd: RunCmd = _run,
) -> dict[str, Any]:
    """callers / affected 来自引擎 JSON。

    已实测（CodeGraph 1.6.0）：`impact --json` → `{symbol, affected:[...]}`；
    `callers --json` → `{symbol, callers:[...]}`；两项均为 camelCase 的
    `{name, kind, filePath, startLine}`。
    """
    if engine_json is not None:
        rows = (
            engine_json.get("affected")
            or engine_json.get("callers")
            or engine_json.get("results")
            or []
        )
        hits = []
        for raw in rows:
            row = raw.get("node") if isinstance(raw.get("node"), dict) else raw
            path = str(row.get("filePath") or row.get("file_path") or row.get("path") or "").strip()
            line = row.get("startLine", row.get("line_start", row.get("line", "")))
            if not path or line in ("", None):
                continue
            hits.append(
                {
                    "repo": alias or Path(repo_abs).name,
                    "symbol": str(row.get("name") or row.get("qualifiedName") or symbol),
                    "path": path,
                    "line": line,
                    "kind": row.get("kind") or "caller",
                    "from_graph": True,
                    "confidence": "inferred",
                }
            )
        return {"status": 0, "hits": hits[:5], "uncovered": [], "truncated": len(hits) > 5, "limit": 5}
    readiness = graph_readiness(repo_abs, which_fn=which_fn, run_cmd=run_cmd)
    if readiness["status"] != 0:
        return readiness
    argv = ["codegraph", "impact", symbol, "--json"]
    ran = run_in_cwd(argv, repo_abs, run_cmd)
    if ran.returncode != 0:
        return {"status": ran.returncode or 1, "stderr": ran.stderr or "", "hits": [], "argv": argv}
    try:
        data = json.loads(ran.stdout or "{}")
    except json.JSONDecodeError:
        return {"status": 1, "stderr": "引擎输出须是 JSON callers\n", "hits": []}
    return impact_of(symbol=symbol, repo_abs=repo_abs, alias=alias, engine_json=data)

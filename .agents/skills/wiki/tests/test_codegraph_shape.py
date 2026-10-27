"""用真实 CodeGraph 1.6.0 输出锁死解析形状。

样本来自实测：`codegraph init` 一个最小 TS 仓后跑
`query --json` / `impact --json` / `callers --json`，原样抄录。
改动解析器前先重跑这三个命令核对，别凭印象改。
"""

import json
from pathlib import Path

import pytest

from code_wiki.graph import impact_of
from code_wiki.query import parse_engine_output

# --- 实测样本（原样） ---

QUERY_JSON = """[
  {
    "node": {
      "id": "method:41ae393a27152f22b8530b576491d879",
      "kind": "method",
      "name": "accrue",
      "qualifiedName": "OrderService::accrue",
      "filePath": "src/order.ts",
      "language": "typescript",
      "startLine": 5,
      "endLine": 7,
      "startColumn": 2,
      "endColumn": 3,
      "signature": "(id: string): string",
      "visibility": null,
      "isExported": false,
      "isAsync": false,
      "isStatic": false,
      "isAbstract": false,
      "updatedAt": 1789846145913
    },
    "score": 92.29747817021848
  }
]"""

IMPACT_JSON = """{
  "symbol": "accrue",
  "depth": 2,
  "nodeCount": 3,
  "edgeCount": 2,
  "affected": [
    { "name": "accrue", "kind": "method", "filePath": "src/order.ts", "startLine": 5 },
    { "name": "create", "kind": "method", "filePath": "src/order.ts", "startLine": 2 },
    { "name": "handleCreate", "kind": "function", "filePath": "src/order.ts", "startLine": 10 }
  ]
}"""

CALLERS_JSON = """{
  "symbol": "accrue",
  "callers": [
    { "name": "create", "kind": "method", "filePath": "src/order.ts", "startLine": 2 }
  ]
}"""


# --- 形状锁 ---


def test_query_shape_unwraps_node_and_camel_case() -> None:
    hits = parse_engine_output(QUERY_JSON)
    assert len(hits) == 1
    hit = hits[0]
    # 字段在 node 里，且是 camelCase —— 这是实测结论，不是猜测
    assert hit["symbol"] == "accrue"
    assert hit["path"] == "src/order.ts"
    assert hit["line"] == 5
    assert hit["kind"] == "method"
    assert hit["from_graph"] is True
    assert hit["score"] == pytest.approx(92.297, abs=1e-3)


def test_query_shape_yields_usable_path_line() -> None:
    """关键契约：解析结果必须能拼出 repo:path:line。"""
    hit = parse_engine_output(QUERY_JSON)[0]
    assert f"{hit['path']}:{hit['line']}" == "src/order.ts:5"


def test_impact_shape_reads_affected_camel_case() -> None:
    data = json.loads(IMPACT_JSON)
    result = impact_of(symbol="accrue", repo_abs="/tmp/probe", alias="probe", engine_json=data)
    assert result["status"] == 0
    assert [h["symbol"] for h in result["hits"]] == ["accrue", "create", "handleCreate"]
    assert all(h["path"] == "src/order.ts" for h in result["hits"])
    assert [h["line"] for h in result["hits"]] == [5, 2, 10]
    assert all(h["from_graph"] is True for h in result["hits"])
    assert all(h["repo"] == "probe" for h in result["hits"])


def test_callers_shape_reads_callers_camel_case() -> None:
    data = json.loads(CALLERS_JSON)
    result = impact_of(symbol="accrue", repo_abs="/tmp/probe", engine_json=data)
    assert len(result["hits"]) == 1
    assert result["hits"][0]["symbol"] == "create"
    assert result["hits"][0]["line"] == 2


def test_impact_truncates_to_five() -> None:
    data = {"affected": [{"name": f"f{i}", "filePath": "src/a.ts", "startLine": i} for i in range(9)]}
    result = impact_of(symbol="f0", repo_abs="/tmp/p", engine_json=data)
    assert len(result["hits"]) == 5
    assert result["truncated"] is True


def test_empty_affected_is_not_an_error() -> None:
    result = impact_of(symbol="x", repo_abs="/tmp/p", engine_json={"symbol": "x", "affected": []})
    assert result["status"] == 0
    assert result["hits"] == []


# --- 仍然保留的宽容与报错 ---


def test_flat_snake_case_still_accepted() -> None:
    """容版本漂移：扁平 snake_case 也认。"""
    text = json.dumps({"results": [{"name": "Login", "file_path": "a/Login.vue", "line_start": 42}]})
    hits = parse_engine_output(text)
    assert hits[0]["path"] == "a/Login.vue"
    assert hits[0]["line"] == 42


def test_unrecognized_shape_raises_not_empty() -> None:
    with pytest.raises(ValueError, match="认不出字段"):
        parse_engine_output(json.dumps({"results": [{"unexpected": "shape"}]}))


def test_missing_container_raises() -> None:
    with pytest.raises(ValueError, match="找不到结果数组"):
        parse_engine_output(json.dumps({"meta": {"count": 0}}))


def test_real_samples_are_valid_json() -> None:
    """样本本身要能被解析，避免抄录时抄坏。"""
    assert isinstance(json.loads(QUERY_JSON), list)
    assert "affected" in json.loads(IMPACT_JSON)
    assert "callers" in json.loads(CALLERS_JSON)


# --- cwd 契约（曾静默丢失，导致查询在错目录执行） ---


def test_run_in_cwd_passes_cwd_through() -> None:
    from code_wiki.graph import run_in_cwd

    seen = {}

    def runner(argv, cwd=None):
        seen["argv"] = argv
        seen["cwd"] = cwd
        return type("R", (), {"returncode": 0, "stdout": "[]", "stderr": ""})()

    run_in_cwd(["codegraph", "query", "x", "--json"], "/tmp/the-repo", runner)
    assert seen["cwd"] == "/tmp/the-repo"


def test_run_in_cwd_falls_back_only_for_argv_only_runners() -> None:
    from code_wiki.graph import run_in_cwd

    calls = []

    def argv_only(argv):
        calls.append(argv)
        return type("R", (), {"returncode": 0, "stdout": "[]", "stderr": ""})()

    # 只作兼容：替身不真执行，丢 cwd 无害
    run_in_cwd(["codegraph", "query", "x"], "/tmp/r", argv_only)
    assert calls == [["codegraph", "query", "x"]]


def test_default_runner_accepts_cwd() -> None:
    """_run 必须收 cwd——否则回退会把 cwd 静静吃掉（已发生过）。"""
    import inspect

    from code_wiki.graph import _run

    assert "cwd" in inspect.signature(_run).parameters


def test_real_engine_sees_repo_not_process_cwd(tmp_path: Path) -> None:
    """真执行路径：cwd 指向 repo，而不是进程当前目录。

    不依赖 codegraph 已安装：断言子进程真的拿到了 cwd。
    """
    from code_wiki.graph import run_in_cwd

    proc = run_in_cwd(["pwd"], str(tmp_path))
    assert proc.returncode == 0
    assert Path(proc.stdout.strip()).resolve() == tmp_path.resolve()

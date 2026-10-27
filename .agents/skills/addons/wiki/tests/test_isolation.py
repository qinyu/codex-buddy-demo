import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_skill_venv_has_no_graph_engine_deps() -> None:
    data = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    deps = data["project"].get("dependencies") or []
    joined = " ".join(deps).lower()
    # 引擎是外部 CLI，不进本 skill 的 venv
    assert "codegraph" not in joined
    assert "code-review-graph" not in joined
    assert "graphify" not in joined
    assert "sentence-transformers" not in joined


def test_uv_lock_does_not_pin_graph_engine() -> None:
    lock = (ROOT / "uv.lock").read_text(encoding="utf-8")
    assert "codegraph" not in lock
    assert "code-review-graph" not in lock
    assert "graphifyy" not in lock
    assert "sentence-transformers" not in lock

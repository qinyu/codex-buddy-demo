from pathlib import Path

import pytest

from code_wiki.wiki import (
    ENTRY_CODE,
    ENTRY_HOWTO,
    HOW_TO_USE,
    INDEX,
    LOG,
    MODULES_DIR,
    MODULE_MAP,
    SEAMS_DIR,
    WikiError,
    confirm_module_map,
    entry_document,
    explore_architecture,
    grill_round,
    ingest,
    is_confirmed,
    lint,
    read_module_map,
    route_query,
    scaffold_module_map,
    write_how_to_use,
)

MODULES = [
    {"id": "M1", "name": "订单", "duty": "下单与状态流转", "seam": "OrderApi", "hint": "src/Order"},
    {"id": "M2", "name": "计价", "duty": "促销与费用计算", "seam": "PricingApi", "hint": "src/Pricing"},
]
SEAMS = [{"from": "订单", "to": "计价", "rule": "只经 PricingApi", "state": "ok"}]


# --- 07 骨架与硬停 ---


def test_explore_uses_dirs_when_git_empty(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "docs" / "project-wiki").mkdir(parents=True)
    (tmp_path / "docs" / "adr").mkdir(parents=True)
    (tmp_path / "docs" / "project-wiki" / "CONTEXT.md").write_text("# 术语\n", encoding="utf-8")
    (tmp_path / "docs" / "adr" / "0001.md").write_text("# a\n", encoding="utf-8")
    explored = explore_architecture(tmp_path, run_git=lambda root: [])
    assert explored["dirs"][0] in {"src", "docs"}
    assert explored["hasContext"] is True
    assert "0001.md" in explored["adrs"]
    assert explored["modules"]
    assert "seam" in explored["brief"]
    assert "module" in explored["brief"]


def test_scaffold_without_modules_fills_hints(tmp_path: Path) -> None:
    (tmp_path / "backend").mkdir()
    result = scaffold_module_map(tmp_path)
    assert result["status"] == "draft"
    text = (tmp_path / MODULE_MAP).read_text(encoding="utf-8")
    assert "backend" in text
    assert "status: draft" in text
    assert result["explore"]["brief"]


def test_scaffold_creates_draft(tmp_path: Path) -> None:
    result = scaffold_module_map(tmp_path, modules=MODULES, seams=SEAMS)
    assert result["status"] == "draft"
    text = (tmp_path / MODULE_MAP).read_text(encoding="utf-8")
    assert "status: draft" in text
    assert "订单" in text and "PricingApi" in text
    assert "变更规则" in text
    assert "事实源（SoR）" in text


def test_draft_blocks_ingest_hard_stop(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES, seams=SEAMS)
    assert is_confirmed(tmp_path) is False
    with pytest.raises(WikiError) as exc:
        ingest(tmp_path)
    assert exc.value.code == 3
    assert "draft" in str(exc.value)
    # 硬停期间不得留下 wiki 内容页
    assert not (tmp_path / MODULES_DIR).exists()
    assert not (tmp_path / SEAMS_DIR).exists()


HINT_ONLY = [
    {"id": "M1", "name": "src", "duty": "（待 agent 按 codebase-design 词表补：这是什么 module）", "seam": "（待补对外 seam 名）", "hint": "src"},
]


def test_grill_round_asks_cut_before_seams(tmp_path: Path) -> None:
    result = scaffold_module_map(tmp_path, modules=HINT_ONLY, seams=[])
    round_ = grill_round(tmp_path)
    kinds = {q["kind"] for q in round_["questions"]}
    assert "module-or-adapter" in kinds or "domain-name" in kinds or "out-of-scope" in kinds
    assert "seam-rule" not in kinds
    assert round_["ready"] is False


def test_grill_round_asks_seams_after_names(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES, seams=SEAMS)
    round_ = grill_round(tmp_path)
    kinds = {q["kind"] for q in round_["questions"]}
    assert "seam-rule" in kinds or round_["ready"] is True
    for q in round_["questions"]:
        assert q["kind"] in {"module-or-adapter", "domain-name", "seam-rule", "out-of-scope"}


def test_confirm_blocked_while_round_open(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=HINT_ONLY, seams=[])
    with pytest.raises(WikiError) as exc:
        confirm_module_map(tmp_path, by="张三")
    assert exc.value.code == 3
    assert is_confirmed(tmp_path) is False


def test_confirm_requires_a_person(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES)
    with pytest.raises(WikiError) as exc:
        confirm_module_map(tmp_path, by="  ")
    assert exc.value.code == 1
    assert is_confirmed(tmp_path) is False


def test_confirm_then_allowed(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES, seams=SEAMS)
    confirm_module_map(tmp_path, by="张三")
    assert is_confirmed(tmp_path) is True
    data = read_module_map(tmp_path)
    assert data["status"] == "confirmed"
    assert data["confirmed_by"] == "张三"


def test_ingest_without_module_map_refuses(tmp_path: Path) -> None:
    with pytest.raises(WikiError) as exc:
        ingest(tmp_path)
    assert exc.value.code == 1


# --- 08 流转 ---


def _confirmed(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES, seams=SEAMS)
    confirm_module_map(tmp_path, by="张三")


def test_skill_copy_matches_ingest_contract() -> None:
    """SKILL 文案与 ingest 产物同路：wiki 活页在 docs/project-wiki/wiki/，不再写反话。"""
    root = Path(__file__).resolve().parents[1]
    skill = (root / "SKILL.md").read_text(encoding="utf-8")
    reference = (root / "references" / "llm-wiki.md").read_text(encoding="utf-8")
    assert "docs/project-wiki/wiki/" in skill
    assert "不要把模块页写进" not in skill
    assert "wiki/" in reference and "modules" in reference
    assert "PowerShell" in skill


def test_ingest_writes_linked_pages(tmp_path: Path) -> None:
    _confirmed(tmp_path)
    result = ingest(tmp_path)
    assert result["modules"] == ["订单", "计价"]
    index = (tmp_path / INDEX).read_text(encoding="utf-8")
    # 页间链接可达
    assert "modules/订单.md" in index or "modules/" in index
    for link in [l for l in result["touched"] if l.startswith("modules/")]:
        assert (tmp_path / "docs/project-wiki/wiki" / link).exists()
    assert (tmp_path / MODULES_DIR / "订单.md").exists()
    assert (tmp_path / SEAMS_DIR).exists()
    module_text = (tmp_path / MODULES_DIR / "订单.md").read_text(encoding="utf-8")
    assert "下单与状态流转" in module_text
    assert "MODULE-MAP.md（已确认）" in module_text


def test_ingest_appends_log(tmp_path: Path) -> None:
    _confirmed(tmp_path)
    ingest(tmp_path, now="2026-01-01T00:00:00+00:00")
    ingest(tmp_path, now="2026-01-02T00:00:00+00:00")
    log = (tmp_path / LOG).read_text(encoding="utf-8")
    assert log.count("ingest：触碰") == 2
    assert "2026-01-01" in log and "2026-01-02" in log


def test_how_to_use_is_entry_b_document(tmp_path: Path) -> None:
    dest = write_how_to_use(tmp_path)
    text = dest.read_text(encoding="utf-8")
    assert "三层分工" in text
    assert "谁说了算（SoR）" in text
    assert "入口 A" in text and "入口 B" in text
    assert "问哪一层" in text


def test_route_query_splits_two_entries() -> None:
    assert route_query(question="知识库里有哪些模块？从哪读起？") == ENTRY_HOWTO
    assert route_query(question="谁说了算？") == ENTRY_HOWTO
    assert route_query(question="下单主路径在哪个模块？") == ENTRY_CODE
    # 显式 kind 优先
    assert route_query(question="随便", kind=ENTRY_HOWTO) == ENTRY_HOWTO
    assert route_query(question="知识库怎么用", kind=ENTRY_CODE) == ENTRY_CODE


def test_entry_document_auto_writes_howto_and_refuses_missing_index(tmp_path: Path) -> None:
    # 入口 B 讲的是「知识库怎么用」，不是关于代码的事实断言：未确认也允许自动生成
    assert not is_confirmed(tmp_path)
    dest = entry_document(tmp_path, ENTRY_HOWTO)
    assert dest.name == "how-to-use.md"
    assert (tmp_path / HOW_TO_USE).exists()
    # 入口 A 是关于代码的结论：未 ingest 就报错
    with pytest.raises(WikiError):
        entry_document(tmp_path, ENTRY_CODE)


def test_lint_reports_and_never_writes(tmp_path: Path) -> None:
    _confirmed(tmp_path)
    ingest(tmp_path)
    # 造一个孤儿页
    (tmp_path / MODULES_DIR / "幽灵.md").write_text("# 幽灵\n", encoding="utf-8")
    before = {p: p.read_text(encoding="utf-8") for p in (tmp_path / MODULES_DIR).glob("*.md")}
    report = lint(tmp_path)
    assert report["readOnly"] is True
    codes = {f["code"] for f in report["findings"]}
    assert "orphan-page" in codes
    after = {p: p.read_text(encoding="utf-8") for p in (tmp_path / MODULES_DIR).glob("*.md")}
    assert before == after


def test_lint_flags_draft_and_missing_context(tmp_path: Path) -> None:
    scaffold_module_map(tmp_path, modules=MODULES)
    report = lint(tmp_path)
    codes = {f["code"] for f in report["findings"]}
    assert "not-confirmed" in codes
    assert "no-context" in codes
    assert report["counts"]["warn"] >= 2


def test_lint_on_empty_workspace_reports_error(tmp_path: Path) -> None:
    report = lint(tmp_path)
    assert any(f["code"] == "no-module-map" and f["level"] == "error" for f in report["findings"])

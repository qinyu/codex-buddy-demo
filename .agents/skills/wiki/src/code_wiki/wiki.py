"""LLM Wiki：模块地图硬停 → CONTEXT/ADR → Ingest / Query 双入口 / Lint。

硬停：`MODULE-MAP.md` 处于 draft 时，禁止写入 wiki/modules 与 wiki/seams。
类比人读代码：先摸清模块边界并让人签字，再往里填内容。
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MODULE_MAP = Path("docs/project-wiki/MODULE-MAP.md")
CONTEXT = Path("docs/project-wiki/CONTEXT.md")
ADR_DIR = Path("docs/adr")
WIKI_DIR = Path("docs/project-wiki/wiki")
INDEX = WIKI_DIR / "index.md"
OVERVIEW = WIKI_DIR / "overview.md"
HOW_TO_USE = WIKI_DIR / "how-to-use.md"
LOG = WIKI_DIR / "log.md"
MODULES_DIR = WIKI_DIR / "modules"
SEAMS_DIR = WIKI_DIR / "seams"

ENTRY_CODE = "code-architecture"
ENTRY_HOWTO = "how-to-use"

DRAFT = "draft"
CONFIRMED = "confirmed"


class WikiError(RuntimeError):
    def __init__(self, message: str, code: int = 2):
        super().__init__(message)
        self.code = code


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SKIP_HINT_DIRS = {".git", "node_modules", ".venv", ".codegraph", "dist", "build", "__pycache__", ".idea"}


def _git_hotspots(repo: Path, *, limit: int = 8) -> list[str]:
    """Matt Explore：先看最近常改的路径（YAGNI）。失败则空列表。"""
    try:
        from code_wiki.proc import run_process

        result = run_process(
            ["git", "-C", str(repo), "log", "--pretty=format:", "--name-only", "-n", "40"],
        )
    except OSError:
        return []
    counts: dict[str, int] = {}
    for line in (result.stdout or "").splitlines():
        path = line.strip()
        if not path or path.startswith("."):
            continue
        top = path.split("/")[0]
        if top in SKIP_HINT_DIRS:
            continue
        hint = "/".join(path.split("/")[:2]) if "/" in path else top
        counts[hint] = counts.get(hint, 0) + 1
    ranked = sorted(counts, key=lambda k: (-counts[k], k))
    return ranked[:limit]


def _top_dirs(root: Path, *, limit: int = 8) -> list[str]:
    rows = []
    try:
        entries = sorted(root.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        return []
    for entry in entries:
        if not entry.is_dir() or entry.name in SKIP_HINT_DIRS or entry.name.startswith("."):
            continue
        rows.append(entry.name)
        if len(rows) >= limit:
            break
    return rows


def explore_architecture(project_root: str | Path, *, run_git=None) -> dict[str, Any]:
    """Matt Explore 的机械部分：热区、目录、CONTEXT/ADR。不改代码、不写 HTML 报告。"""
    root = Path(project_root).resolve()
    context = root / CONTEXT
    adr = root / ADR_DIR
    hotspots = _git_hotspots(root) if run_git is None else run_git(root)
    dirs = _top_dirs(root)
    hints = hotspots or dirs
    modules = []
    for index, hint in enumerate(hints, start=1):
        name = hint.rstrip("/").split("/")[-1]
        modules.append({
            "id": f"M{index}",
            "name": name,
            "duty": "（待 agent 按 codebase-design 词表补：这是什么 module）",
            "seam": "（待补对外 seam 名）",
            "hint": hint,
        })
    adrs = []
    if adr.is_dir():
        adrs = sorted(p.name for p in adr.glob("*.md"))
    return {
        "hotspots": hotspots,
        "dirs": dirs,
        "hasContext": context.exists(),
        "adrs": adrs,
        "modules": modules,
        "seams": [],
        "outOfScope": "improve 的 deepening / 改业务代码不在此步。",
        "brief": (
            "先读 CONTEXT.md 与 docs/adr/（若有）。用词：module / seam / depth。"
            "路径 hint 来自热区或顶层目录，领域名待补。"
        ),
    }


# --- 模块地图 ---


def module_map_path(project_root: str | Path) -> Path:
    return Path(project_root).resolve() / MODULE_MAP


def _render_module_map(*, status: str, modules: list[dict[str, str]], seams: list[dict[str, str]],
                       confirmed_by: str = "", confirmed_at: str = "", out_of_scope: str = "") -> str:
    lines = [
        "# MODULE-MAP",
        "",
        f"status: {status}",
        f"confirmed_by: {confirmed_by}",
        f"confirmed_at: {confirmed_at}",
        "",
        "> 变更规则：增删模块或改 seam 名 → 回人确认 → 再 ingest。",
        "> 事实源（SoR）：模块划分认本文件；术语认 CONTEXT.md；决策认 docs/adr/*。",
        "",
        "## Modules",
        "",
        "| ID | 领域名 | 一句话职责 | 对外 seam | 路径 hint |",
        "|---|---|---|---|---|",
    ]
    for m in modules or [{"id": "", "name": "", "duty": "", "seam": "", "hint": ""}]:
        lines.append(
            f"| {m.get('id','')} | {m.get('name','')} | {m.get('duty','')} | {m.get('seam','')} | {m.get('hint','')} |"
        )
    lines += [
        "",
        "## Seams",
        "",
        "| From | To | 约定 | 现状 |",
        "|---|---|---|---|",
    ]
    for s in seams or [{"from": "", "to": "", "rule": "", "state": ""}]:
        lines.append(f"| {s.get('from','')} | {s.get('to','')} | {s.get('rule','')} | {s.get('state','')} |")
    lines += ["", "## Out of scope", "", out_of_scope or "（待填）", ""]
    return "\n".join(lines)


def scaffold_module_map(
    project_root: str | Path,
    *,
    modules: list[dict[str, str]] | None = None,
    seams: list[dict[str, str]] | None = None,
    out_of_scope: str = "",
    write: bool = True,
) -> dict[str, Any]:
    """产出草稿。未传入模块时先 Explore 收路径 hint。默认 draft，必须人确认。"""
    dest = module_map_path(project_root)
    explored = None
    if modules is None:
        explored = explore_architecture(project_root)
        modules = explored["modules"]
        seams = seams if seams is not None else explored["seams"]
        out_of_scope = out_of_scope or explored["outOfScope"]
    body = _render_module_map(status=DRAFT, modules=modules or [], seams=seams or [], out_of_scope=out_of_scope)
    if write:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(body, encoding="utf-8")
    result = {"path": str(dest), "status": DRAFT, "modules": len(modules or []), "seams": len(seams or []), "body": body}
    if explored:
        result["explore"] = {
            "hotspots": explored["hotspots"],
            "hasContext": explored["hasContext"],
            "adrs": explored["adrs"],
            "brief": explored["brief"],
        }
    return result


def _parse_table(text: str, header: str) -> list[dict[str, str]]:
    m = re.search(rf"## {re.escape(header)}\s*\n(.*?)(?=\n## |\Z)", text, re.S)
    if not m:
        return []
    rows = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line.startswith("|") or set(line) <= {"|", "-", " "}:
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        rows.append(cells)
    if not rows:
        return []
    keys = rows[0]
    return [dict(zip(keys, row)) for row in rows[1:] if any(row)]


def read_module_map(project_root: str | Path) -> dict[str, Any] | None:
    dest = module_map_path(project_root)
    if not dest.exists():
        return None
    text = dest.read_text(encoding="utf-8")
    status = DRAFT
    m = re.search(r"^status:\s*(\S+)", text, re.M)
    if m:
        status = m.group(1).strip()
    confirmed_by = ""
    m = re.search(r"^confirmed_by:\s*(.*)$", text, re.M)
    if m:
        confirmed_by = m.group(1).strip()
    return {
        "path": str(dest),
        "status": status,
        "confirmed_by": confirmed_by,
        "modules": _parse_table(text, "Modules"),
        "seams": _parse_table(text, "Seams"),
    }


def is_confirmed(project_root: str | Path) -> bool:
    data = read_module_map(project_root)
    return bool(data and data["status"] == CONFIRMED and data["confirmed_by"])


PLACEHOLDER_DUTY = "（待 agent 按 codebase-design 词表补：这是什么 module）"
PLACEHOLDER_SEAM = "（待补对外 seam 名）"
GRILL_KINDS = ("module-or-adapter", "domain-name", "seam-rule", "out-of-scope")


def _row_named(row: dict[str, str]) -> bool:
    name = (row.get("领域名") or row.get("name") or "").strip()
    if not name:
        return False
    if name in {".", "src", "lib", "app", "backend", "frontend"} and (
        (row.get("一句话职责") or row.get("duty") or "").startswith("（待")
    ):
        return False
    duty = (row.get("一句话职责") or row.get("duty") or "").strip()
    return duty != PLACEHOLDER_DUTY and not duty.startswith("（待")


def _seam_named(row: dict[str, str]) -> bool:
    seam = (row.get("对外 seam") or row.get("seam") or "").strip()
    return bool(seam) and seam != PLACEHOLDER_SEAM and not seam.startswith("（待")


def grill_round(project_root: str | Path) -> dict[str, Any]:
    """当前前沿：模块名单未定不问接缝。题目只有切法/命名/seam/范围。"""
    data = read_module_map(project_root)
    if data is None:
        raise WikiError("还没有 MODULE-MAP.md；先 scaffold 出草稿。", 1)
    questions: list[dict[str, str]] = []
    unnamed = [row for row in data["modules"] if not _row_named(row)]
    if unnamed:
        for row in unnamed:
            hint = (row.get("路径 hint") or row.get("hint") or "").strip()
            ident = (row.get("ID") or row.get("id") or hint or "?")
            questions.append({
                "kind": "module-or-adapter",
                "about": ident,
                "hint": hint,
                "recommend": "module" if hint else "out-of-scope",
            })
            questions.append({
                "kind": "domain-name",
                "about": ident,
                "hint": hint,
                "recommend": hint.split("/")[-1] if hint else "",
            })
        questions.append({
            "kind": "out-of-scope",
            "about": "map",
            "hint": "",
            "recommend": "运行脚本、构建产物、第三方目录",
        })
        return {"ready": False, "questions": questions}
    for row in data["seams"]:
        rule = (row.get("约定") or row.get("rule") or "").strip()
        if not rule or rule.startswith("（待"):
            frm = (row.get("From") or row.get("from") or "").strip()
            to = (row.get("To") or row.get("to") or "").strip()
            questions.append({
                "kind": "seam-rule",
                "about": f"{frm}->{to}",
                "hint": "",
                "recommend": "只经对外 seam",
            })
    for row in data["modules"]:
        if not _seam_named(row):
            ident = (row.get("领域名") or row.get("ID") or "")
            questions.append({
                "kind": "seam-rule",
                "about": ident,
                "hint": (row.get("路径 hint") or ""),
                "recommend": PLACEHOLDER_SEAM,
            })
    return {"ready": not questions, "questions": questions}


def confirm_module_map(project_root: str | Path, *, by: str, now: str | None = None) -> dict[str, Any]:
    """人签字：draft → confirmed。前沿未空则拒绝。"""
    if not by.strip():
        raise WikiError("确认模块地图必须留下确认人（--by）。", 1)
    data = read_module_map(project_root)
    if data is None:
        raise WikiError("还没有 MODULE-MAP.md；先 scaffold 出草稿。", 1)
    pending = grill_round(project_root)
    if not pending["ready"]:
        raise WikiError("grilling 前沿未空，不能升 confirmed。先答完当前轮再签字。", 3)
    dest = module_map_path(project_root)
    text = dest.read_text(encoding="utf-8")
    text = re.sub(r"^status:\s*\S+", f"status: {CONFIRMED}", text, count=1, flags=re.M)
    text = re.sub(r"^confirmed_by:\s*.*$", f"confirmed_by: {by}", text, count=1, flags=re.M)
    text = re.sub(r"^confirmed_at:\s*.*$", f"confirmed_at: {now or _now()}", text, count=1, flags=re.M)
    dest.write_text(text, encoding="utf-8")
    return {"path": str(dest), "status": CONFIRMED, "confirmed_by": by}


def _require_confirmed(project_root: str | Path) -> dict[str, Any]:
    data = read_module_map(project_root)
    if data is None:
        raise WikiError("没有 MODULE-MAP.md；先 scaffold 并让人确认。", 1)
    if not is_confirmed(project_root):
        raise WikiError(
            "MODULE-MAP 仍是 draft，禁止写入 wiki/modules 与 wiki/seams。先让人确认（confirmed_by）。",
            3,
        )
    return data


# --- Ingest ---


def _slug(text: str) -> str:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", (text or "").strip()).strip("-").lower()
    return cleaned or "unnamed"


def ingest(project_root: str | Path, *, write: bool = True, now: str | None = None) -> dict[str, Any]:
    """按确认过的地图编译活页。draft 时拒绝。"""
    root = Path(project_root).resolve()
    data = _require_confirmed(root)
    pages: list[str] = []
    module_pages: list[tuple[str, str]] = []
    for row in data["modules"]:
        name = row.get("领域名") or row.get("ID") or ""
        if not name:
            continue
        slug = _slug(name)
        link = f"modules/{slug}.md"
        module_pages.append((name, link))
        body = "\n".join([
            f"# {name}",
            "",
            f"- 职责：{row.get('一句话职责','') or '（待补）'}",
            f"- 对外 seam：{row.get('对外 seam','') or '（待补）'}",
            f"- 路径 hint：{row.get('路径 hint','') or '（待补）'}",
            "",
            "> 来源：MODULE-MAP.md（已确认）。结论须能回到代码路径。",
            "",
        ])
        pages.append((link, body))
    seam_pages: list[tuple[str, str]] = []
    for row in data["seams"]:
        label = f"{row.get('From','')}->{row.get('To','')}".strip("->")
        if not label:
            continue
        slug = _slug(label)
        link = f"seams/{slug}.md"
        seam_pages.append((link, "\n".join([
            f"# 接缝 {label}",
            "",
            f"- 约定：{row.get('约定','') or '（待补）'}",
            f"- 现状：{row.get('现状','') or '（待补）'}",
            "",
        ])))
    index_body = "\n".join(
        ["# Wiki Index", "", "## 模块", ""]
        + [f"- [{name}]({link})" for name, link in module_pages]
        + ["", "## 接缝", ""]
        + [f"- [{link.split('/')[-1][:-3]}]({link})" for link, _ in seam_pages]
        + ["", "入口 B（问知识库怎么用）：[how-to-use.md](how-to-use.md)", ""]
    )
    overview_body = "\n".join([
        "# 概览",
        "",
        f"- 模块数：{len(module_pages)}",
        f"- 接缝数：{len(seam_pages)}",
        f"- 事实源：MODULE-MAP.md（confirmed_by={data['confirmed_by']}）",
        "",
    ])
    touched: list[str] = ["index.md", "overview.md"]
    if write:
        MODULES_DIR_ROOT = root / MODULES_DIR
        SEAMS_DIR_ROOT = root / SEAMS_DIR
        MODULES_DIR_ROOT.mkdir(parents=True, exist_ok=True)
        SEAMS_DIR_ROOT.mkdir(parents=True, exist_ok=True)
        (root / INDEX).write_text(index_body, encoding="utf-8")
        (root / OVERVIEW).write_text(overview_body, encoding="utf-8")
        for link, body in pages:
            (root / WIKI_DIR / link).write_text(body, encoding="utf-8")
            touched.append(link)
        for link, body in seam_pages:
            (root / WIKI_DIR / link).write_text(body, encoding="utf-8")
            touched.append(link)
        write_how_to_use(root)
        touched.append("how-to-use.md")
        stamp = now or _now()
        with (root / LOG).open("a", encoding="utf-8") as fh:
            fh.write(f"- {stamp} ingest：触碰 {len(touched)} 页\n")
    return {
        "modules": [name for name, _ in module_pages],
        "seams": len(seam_pages),
        "touched": touched,
        "index": str(root / INDEX),
        "wikiRef": str(root / INDEX),
    }


def write_how_to_use(project_root: str | Path) -> Path:
    """入口 B 的固定页。"""
    root = Path(project_root).resolve()
    dest = root / HOW_TO_USE
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join([
        "# 这个知识库怎么用",
        "",
        "## 三层分工",
        "",
        "- 结构事实：本 skill 的 `$wiki query --kind search|cite|impact`（仓内 CodeGraph）",
        "- 符号：本 skill 的 LSP（`lsp plan` / `lsp verify`）",
        "- 叙事：本 wiki（模块页 / 接缝页 / ADR）",
        "",
        "## 谁说了算（SoR）",
        "",
        "| 事实 | 以哪份为准 |",
        "|---|---|",
        "| 模块怎么划分 | `docs/project-wiki/MODULE-MAP.md`（须 confirmed） |",
        "| 领域词 | `docs/project-wiki/CONTEXT.md` |",
        "| 难逆转取舍 | `docs/adr/*` |",
        "| 模块叙事 | `docs/project-wiki/wiki/modules/*`、`wiki/seams/*` |",
        "",
        "## 两种提问入口",
        "",
        "- **入口 A（问代码架构）**：下单主路径在哪个模块？改这个会不会动到那条接缝？",
        "  → 先读 `index.md`，再打开模块页 / 接缝页；跳文件用路径 hint，关系问题转 `$wiki query --kind impact`。",
        "- **入口 B（问知识库怎么用）**：从哪读起？谁说了算？新 PR 该 ingest 还是直接改？",
        "  → 就是本页。",
        "",
        "## 什么时候 ingest / lint",
        "",
        "- 模块地图确认后、合并重要 PR 后、事故复盘后 → ingest",
        "- 每周或热区大变 → lint（只报告，不改文件）",
        "",
        "## 问哪一层",
        "",
        "- 函数级调用 / 影响范围 → `$wiki query --kind impact`",
        "- 符号定义 / 引用 → 本 skill 的 LSP",
        "- 未确认的切法 → 先 `wiki grill` / `confirm`",
        "",
    ]), encoding="utf-8")
    return dest


# --- Query 路由 ---


def route_query(*, question: str = "", kind: str = "") -> str:
    """把提问分到两个入口。kind 显式给定时以它为准。"""
    if kind == ENTRY_HOWTO:
        return ENTRY_HOWTO
    if kind == ENTRY_CODE:
        return ENTRY_CODE
    text = (question or "").lower()
    howto_markers = ("怎么用", "从哪读", "谁说了算", "哪些模块", "how to use", "ingest", "lint", "怎么提问")
    if any(marker in text for marker in howto_markers):
        return ENTRY_HOWTO
    return ENTRY_CODE


def entry_document(project_root: str | Path, entry: str) -> Path:
    """取入口文档。

    入口 B（how-to-use）讲的是「本知识库怎么用」，不是关于该仓代码的事实断言，
    所以**不要求先确认模块地图**：首次访问时自动生成。
    入口 A（index）是关于代码的结论，必须先 confirm 再 ingest，否则报错。
    """
    root = Path(project_root).resolve()
    if entry == ENTRY_HOWTO:
        dest = root / HOW_TO_USE
        if not dest.exists():
            write_how_to_use(root)
        return dest
    if entry == ENTRY_CODE:
        dest = root / INDEX
        if not dest.exists():
            raise WikiError("还没有 wiki index；先确认 MODULE-MAP 再 ingest。", 1)
        return dest
    raise WikiError(f"未知入口：{entry}", 1)


# --- Lint ---


def lint(project_root: str | Path) -> dict[str, Any]:
    """报告式体检。**不修改任何文件。**"""
    root = Path(project_root).resolve()
    findings: list[dict[str, str]] = []
    data = read_module_map(root)
    if data is None:
        findings.append({"level": "error", "code": "no-module-map", "message": "缺 MODULE-MAP.md"})
        data = {"status": DRAFT, "confirmed_by": "", "modules": [], "seams": []}
    elif data["status"] != CONFIRMED:
        findings.append({"level": "warn", "code": "not-confirmed", "message": "MODULE-MAP 仍是 draft，未确认"})
    if not (root / CONTEXT).exists():
        findings.append({"level": "warn", "code": "no-context", "message": "缺 CONTEXT.md（术语 SoR）"})
    if not (root / ADR_DIR).exists():
        findings.append({"level": "info", "code": "no-adr", "message": "缺 docs/adr/（决策 SoR）"})
    expected = {_slug(row.get("领域名") or row.get("ID") or "") for row in data["modules"]}
    expected.discard("")
    actual: set[str] = set()
    if (root / MODULES_DIR).exists():
        actual = {p.stem for p in (root / MODULES_DIR).glob("*.md")}
    for orphan in sorted(actual - expected):
        findings.append({"level": "warn", "code": "orphan-page", "message": f"孤儿页：modules/{orphan}.md 不在地图里"})
    for missing in sorted(expected - actual):
        findings.append({"level": "info", "code": "missing-page", "message": f"地图里有模块但无页：{missing}"})
    return {
        "findings": findings,
        "counts": {
            "error": sum(1 for f in findings if f["level"] == "error"),
            "warn": sum(1 for f in findings if f["level"] == "warn"),
            "info": sum(1 for f in findings if f["level"] == "info"),
        },
        "readOnly": True,
        "message": "只报告，不改文件。地图需大改时回人确认。",
    }

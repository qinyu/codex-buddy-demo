"""AGENTS marker 与 gitignore marker。不改套件托管块。"""

from __future__ import annotations

from pathlib import Path

STRUCTURE_BEGIN = "<!-- BEGIN code-wiki:structure -->"
STRUCTURE_END = "<!-- END code-wiki:structure -->"
KNOWLEDGE_BEGIN = "<!-- BEGIN code-wiki:knowledge -->"
KNOWLEDGE_END = "<!-- END code-wiki:knowledge -->"
PROMPT_BEGIN = "<!-- BEGIN code-wiki:prompt -->"
PROMPT_END = "<!-- END code-wiki:prompt -->"
CHARTER_END = "<!-- END product-workflow charter -->"

GITIGNORE_START = "# code-wiki:gitignore:start"
GITIGNORE_END = "# code-wiki:gitignore:end"
IGNORE_ENTRIES = [".codegraph/", "repos.txt", "workspace.json"]


class CharterError(ValueError):
    pass


def agents_path(project_root: str | Path) -> Path:
    root = Path(project_root).resolve()
    for name in ("AGENTS.md", "CLAUDE.md"):
        dest = root / name
        if dest.exists():
            return dest
    return root / "AGENTS.md"


def charter_present(text: str) -> bool:
    return PROMPT_BEGIN in text and KNOWLEDGE_BEGIN in text


def wrap(begin: str, end: str, body: str | None) -> str:
    inner = (body or "").strip() or "(empty)"
    return f"{begin}\n{inner}\n{end}"


def replace_or_append(text: str, begin: str, end: str, block: str) -> str:
    start = text.find(begin)
    stop = text.find(end)
    if start != -1 and stop != -1 and stop > start:
        return text[:start] + block + text[stop + len(end) :]
    trimmed = text.rstrip()
    if not trimmed:
        return f"{block}\n"
    return f"{trimmed}\n\n{block}\n"


def default_prompt(*, repo_count: int = 1, aliases: list[str] | None = None) -> str:
    n = repo_count if repo_count > 0 else 1
    names = "、".join(aliases) if aliases else "当前仓"
    return (
        f"STOP. {n} 仓（{names}）。现有实现 / 改前引用 / 谁调用了 → $wiki query。"
        "刚 pull 或本会话第一次查图 → $wiki refresh。"
    )


def default_knowledge(*, aliases: list[str] | None = None, provider: str = "codegraph") -> str:
    if aliases:
        alias_line = "\n".join(f"- {name}：docs/project-wiki/glossary/{name}.json" for name in aliases)
    else:
        alias_line = "- （init 后按 alias 补词表路径）"
    return "\n".join(
        [
            "- 状态：已建（本机图谱，codegraph）",
            f"- 用哪套：{provider}",
            "- 怎么查：wiki 路径 + 业务问题 → $wiki query；符号名 → $wiki query --kind cite|impact",
            "- 换引擎只改「用哪套」；查询与 refresh 仍走 $wiki，不写死某一家 CLI",
            "- 自动同步：当前引擎监听文件变更，图不需手动重建；refresh 只做体检",
            "- 分仓：",
            alias_line,
        ]
    )


def skeleton_document(*, knowledge: str = "", structure: str = "", prompt: str = "") -> str:
    lines = [
        "# AGENTS.md",
        "",
        wrap(PROMPT_BEGIN, PROMPT_END, prompt or default_prompt()),
        "",
        "本文件给编码助手读。人看 README。",
        "",
        "套件章程由 `$product:setup` 注入下方锚点。",
        "",
        "<!-- BEGIN product-workflow charter suite=VERSION -->",
        CHARTER_END,
        "",
        wrap(STRUCTURE_BEGIN, STRUCTURE_END, structure or "（待从源码填写模块、分层、命名/测试惯例）"),
        "",
        wrap(KNOWLEDGE_BEGIN, KNOWLEDGE_END, knowledge or default_knowledge()),
        "",
    ]
    return "\n".join(lines) + "\n"


def upsert_charter(
    existing: str,
    *,
    knowledge: str,
    structure: str | None = None,
    prompt: str | None = None,
) -> str:
    next_text = existing
    if prompt is not None:
        next_text = replace_or_append(
            next_text, PROMPT_BEGIN, PROMPT_END, wrap(PROMPT_BEGIN, PROMPT_END, prompt)
        )
    if structure is not None:
        next_text = replace_or_append(
            next_text, STRUCTURE_BEGIN, STRUCTURE_END, wrap(STRUCTURE_BEGIN, STRUCTURE_END, structure)
        )
    next_text = replace_or_append(
        next_text, KNOWLEDGE_BEGIN, KNOWLEDGE_END, wrap(KNOWLEDGE_BEGIN, KNOWLEDGE_END, knowledge)
    )
    line_count = len(next_text.split("\n"))
    if line_count > 200:
        raise CharterError(f"AGENTS.md 将超过 200 行（{line_count}），请先裁剪再 upsert")
    return next_text if next_text.endswith("\n") else f"{next_text}\n"


def write_charter(
    agents_path: str | Path,
    *,
    knowledge: str,
    structure: str | None = None,
    prompt: str | None = None,
    skeleton: bool = False,
) -> Path:
    dest = Path(agents_path).resolve()
    if not dest.exists() and not skeleton:
        raise CharterError(f"文件不存在：{dest}（需要 --skeleton 才生成瘦骨架）")
    if not dest.exists() and skeleton:
        next_text = skeleton_document(knowledge=knowledge, structure=structure or "", prompt=prompt or "")
    else:
        next_text = upsert_charter(
            dest.read_text(encoding="utf-8"),
            knowledge=knowledge,
            structure=structure,
            prompt=prompt,
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(next_text, encoding="utf-8")
    return dest


def gitignore_block() -> str:
    return "\n".join([GITIGNORE_START, *IGNORE_ENTRIES, GITIGNORE_END])


def upsert_gitignore(text: str) -> str:
    block = gitignore_block()
    start = text.find(GITIGNORE_START)
    stop = text.find(GITIGNORE_END)
    if start != -1 and stop != -1 and stop > start:
        return (text[:start] + block + text[stop + len(GITIGNORE_END) :]).rstrip() + "\n"
    trimmed = text.rstrip()
    if not trimmed:
        return f"{block}\n"
    return f"{trimmed}\n\n{block}\n"


def apply_gitignore(project_root: str | Path, *, dry_run: bool = False) -> dict[str, object]:
    dest = Path(project_root).resolve() / ".gitignore"
    existing = dest.read_text(encoding="utf-8") if dest.exists() else ""
    next_text = upsert_gitignore(existing)
    if dry_run:
        return {"dest": str(dest), "written": False, "next": next_text}
    dest.write_text(next_text if next_text.endswith("\n") else f"{next_text}\n", encoding="utf-8")
    return {"dest": str(dest), "written": True, "next": next_text}

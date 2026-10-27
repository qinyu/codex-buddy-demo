"""显式子命令入口；查询与获准的准备/同步操作分开执行。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from code_wiki.charter import CharterError
from code_wiki.graph import lookup
from code_wiki.init import InitError, bootstrap, ensure, refresh_graphs
from code_wiki.lsp import LspError, cli_plan, install as lsp_install, record_verification
from code_wiki.migrate import MigrateError, migration_report, migrate
from code_wiki.onboard import onboard
from code_wiki.sshkey import ensure_key, verify_connection, upload_guide
from code_wiki.wiki import (
    ENTRY_CODE,
    ENTRY_HOWTO,
    WikiError,
    confirm_module_map,
    entry_document,
    grill_round,
    ingest,
    lint as wiki_lint,
    route_query,
    scaffold_module_map,
)
from code_wiki.workspace import WorkspaceError


def _print_json(data) -> None:
    sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def _fail(exc: Exception) -> int:
    sys.stderr.write(f"{exc}\n")
    return getattr(exc, "code", 2)


def _repos_from_args(args: argparse.Namespace) -> list[dict[str, str]]:
    aliases = args.alias or []
    urls = args.url or []
    paths = args.path or []
    branches = args.branch or []
    n = max(len(aliases), len(urls))
    repos = []
    for i in range(n):
        repos.append(
            {
                "alias": aliases[i] if i < len(aliases) else "",
                "url": urls[i] if i < len(urls) else "",
                "path": paths[i] if i < len(paths) else "",
                "branch": branches[i] if i < len(branches) else "",
            }
        )
    return repos


def cmd_ensure(args: argparse.Namespace) -> int:
    try:
        result = ensure(args.workspace, dry_run=args.dry_run)
    except (InitError, WorkspaceError, CharterError) as exc:
        return _fail(exc)
    _print_json(result)
    if result.get("next") == "ask-repos":
        sys.stderr.write(result.get("message") or "工作区没有 git 仓。\n")
        return 2
    if result.get("next") == "retry-clone":
        for row in result.get("failed") or []:
            name = row.get("alias") or row.get("url")
            sys.stderr.write(f"{name} clone 失败（已跳过，其余仓继续）：{row.get('error')}\n")
        return 4
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    try:
        result = bootstrap(
            args.workspace,
            repositories=_repos_from_args(args) or None,
            repos_file=args.repos or None,
            repo=args.repo,
            dir=args.dir,
            branch=args.git_branch,
            dry_run=args.dry_run,
            name=args.name,
            allow_install=args.allow_install,
        )
    except (InitError, WorkspaceError, CharterError) as exc:
        return _fail(exc)
    _print_json(result)
    return 0


def cmd_query(args: argparse.Namespace) -> int:
    if args.kind == "search" and not args.question:
        sys.stderr.write("query --kind search 需要 --question\n")
        return 1
    if args.kind != "search" and not (args.symbol or args.question):
        sys.stderr.write("query --kind cite|impact 需要 --symbol 或 --question\n")
        return 1
    engine_text = Path(args.engine_json).read_text(encoding="utf-8") if args.engine_json else None
    engine_json = json.loads(engine_text) if args.kind == "impact" and engine_text else None
    result = lookup(
        question=args.question,
        symbol=args.symbol,
        kind=args.kind,
        glossary_path=args.glossary,
        repo_abs=args.repo,
        alias=args.alias,
        wiki_ref=args.wiki_ref,
        limit=args.limit,
        engine_text=None if args.kind == "impact" else engine_text,
        engine_json=engine_json,
        cli=args.cli,
    )
    if result.get("status") not in (0, None):
        sys.stderr.write(result.get("stderr") or "query 失败\n")
        return int(result["status"])
    _print_json(result)
    return 0


def cmd_migrate(args: argparse.Namespace) -> int:
    try:
        if args.plan:
            _print_json(migration_report(args.workspace))
            return 0
        result = migrate(args.workspace, dry_run=args.dry_run, confirmed=args.yes)
    except (MigrateError, InitError) as exc:
        return _fail(exc)
    _print_json(result)
    if result.get("next") == "install-then-init":
        sys.stderr.write("已清旧引擎；缺 codegraph，装完再跑 migrate --yes 或 init。\n")
        return 2
    return 0


def cmd_lsp(args: argparse.Namespace) -> int:
    try:
        if args.lsp_command == "plan":
            _print_json(cli_plan(system=args.system))
            return 0
        if args.lsp_command == "install":
            result = lsp_install(args.client, confirmed=args.yes)
            _print_json(result)
            return 0 if result.get("installed") or result.get("next") == "manual" else 3
        results = {
            "definition": args.definition,
            "references": args.references,
            "diagnostics": args.diagnostics,
        }
        body = record_verification(args.workspace, client=args.client, results=results)
        _print_json(body)
        return 0 if body["passed"] else 3
    except LspError as exc:
        return _fail(exc)


def cmd_wiki(args: argparse.Namespace) -> int:
    try:
        if args.wiki_command == "scaffold":
            _print_json(scaffold_module_map(args.workspace))
            return 0
        if args.wiki_command == "grill":
            _print_json(grill_round(args.workspace))
            return 0
        if args.wiki_command == "confirm":
            _print_json(confirm_module_map(args.workspace, by=args.by))
            return 0
        if args.wiki_command == "ingest":
            _print_json(ingest(args.workspace))
            return 0
        if args.wiki_command == "lint":
            _print_json(wiki_lint(args.workspace))
            return 0
        entry = route_query(question=args.question, kind=args.entry)
        dest = entry_document(args.workspace, entry)
        _print_json({"entry": entry, "path": str(dest)})
        return 0
    except WikiError as exc:
        return _fail(exc)


def cmd_onboard(args: argparse.Namespace) -> int:
    repos = _repos_from_args(args) or None
    try:
        result = onboard(
            args.workspace,
            repos=repos,
            repos_file=args.repos or None,
            git_base=args.git_base,
            allow_ssh_generate=args.yes_ssh,
            allow_install=args.yes_install,
            dry_run=args.dry_run,
        )
    except (InitError, WorkspaceError, ValueError) as exc:
        return _fail(exc)
    _print_json(result)
    next_step = result.get("next")
    if next_step == "ask-repos":
        sys.stderr.write(result.get("purpose", "") + "\n")
        return 2
    if next_step == "ask-permission":
        sys.stderr.write("需要你的许可：" + result.get("ask", {}).get("ask", "") + "\n")
        return 3
    if next_step in ("retry-clone", "retry-graph", "retry-lsp"):
        sys.stderr.write(f"上手未完成：{next_step}；查看 steps 并重试失败项。\n")
        return 4
    return 0


def cmd_ssh(args: argparse.Namespace) -> int:
    if args.ssh_command == "ensure":
        try:
            _print_json(ensure_key(confirm=True, git_base=args.git_base))
        except ValueError as exc:
            return _fail(exc)
        return 0
    if args.ssh_command == "guide":
        _print_json(upload_guide(args.url, host=args.host))
        return 0
    probe = verify_connection(args.host)
    _print_json(probe)
    return 0 if probe["ok"] else 4


def cmd_refresh(args: argparse.Namespace) -> int:
    try:
        result = refresh_graphs(args.workspace, dry_run=args.dry_run)
    except InitError as exc:
        return _fail(exc)
    _print_json(result)
    if result.get("no_graph"):
        sys.stderr.write("有仓无图：先 $wiki init。\n")
        return 3
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="code-wiki")
    sub = parser.add_subparsers(dest="command")

    p_ensure = sub.add_parser("ensure", help="没仓问拉取；有仓补 AGENTS；有章程再 refresh")
    p_ensure.add_argument("workspace", nargs="?", default=".")
    p_ensure.add_argument("--dry-run", action="store_true")
    p_ensure.set_defaults(func=cmd_ensure)

    p_init = sub.add_parser("init", help="按 别名=地址 清单 clone → 分仓建图；拉齐丢清单")
    p_init.add_argument("workspace")
    p_init.add_argument("--alias", action="append", default=[])
    p_init.add_argument("--url", action="append", default=[])
    p_init.add_argument("--path", action="append", default=[])
    p_init.add_argument("--branch", action="append", default=[])
    p_init.add_argument("--name", default="")
    p_init.add_argument("--repos", default="")
    p_init.add_argument("--repo", default="")
    p_init.add_argument("--dir", default="")
    p_init.add_argument("--git-branch", default="")
    p_init.add_argument("--dry-run", action="store_true")
    p_init.add_argument("--allow-install", action="store_true")
    p_init.set_defaults(func=cmd_init)

    p_query = sub.add_parser("query", help="查图。--kind cite|impact 走确定边")
    p_query.add_argument("--repo", required=True)
    p_query.add_argument("--question", default="")
    p_query.add_argument("--symbol", default="")
    p_query.add_argument("--kind", choices=("search", "cite", "impact"), default="search")
    p_query.add_argument("--alias", default="")
    p_query.add_argument("--glossary", default="")
    p_query.add_argument("--wiki-ref", default="")
    p_query.add_argument("--limit", type=int, default=5)
    p_query.add_argument("--engine-json", default="")
    p_query.add_argument("--cli", default="")
    p_query.set_defaults(func=cmd_query)

    p_refresh = sub.add_parser("refresh", help="体检 + 增量对账（codegraph sync）")
    p_refresh.add_argument("workspace")
    p_refresh.add_argument("--dry-run", action="store_true")
    p_refresh.set_defaults(func=cmd_refresh)

    p_migrate = sub.add_parser("migrate", help="从旧引擎 code-review-graph 迁到 CodeGraph")
    p_migrate.add_argument("workspace", nargs="?", default=".")
    p_migrate.add_argument("--plan", action="store_true", help="只出报告，不动任何东西")
    p_migrate.add_argument("--yes", action="store_true", help="确认执行（未加时只报告）")
    p_migrate.add_argument("--dry-run", action="store_true")
    p_migrate.set_defaults(func=cmd_migrate)

    p_onboard = sub.add_parser("onboard", help="非技术向上手：能代做的做完，剩下收成一次提问")
    p_onboard.add_argument("workspace", nargs="?", default=".")
    p_onboard.add_argument("--alias", action="append", default=[])
    p_onboard.add_argument("--url", action="append", default=[])
    p_onboard.add_argument("--path", action="append", default=[])
    p_onboard.add_argument("--branch", action="append", default=[])
    p_onboard.add_argument("--repos", default="")
    p_onboard.add_argument("--git-base", default="", help="已确认的代码仓主机")
    p_onboard.add_argument("--yes-ssh", action="store_true", help="允许代生成 SSH Key")
    p_onboard.add_argument("--yes-install", action="store_true", help="允许代装引擎")
    p_onboard.add_argument("--dry-run", action="store_true")
    p_onboard.set_defaults(func=cmd_onboard)

    p_ssh = sub.add_parser("ssh", help="SSH Key：检查/生成、上传引导、连通验证")
    ssh_sub = p_ssh.add_subparsers(dest="ssh_command")
    p_ssh_ensure = ssh_sub.add_parser("ensure", help="检查；缺则（需 --yes）代生成")
    p_ssh_ensure.add_argument("--git-base", required=True, help="已确认的代码仓主机")
    p_ssh_ensure.add_argument("--yes", action="store_true")
    p_ssh_ensure.set_defaults(func=cmd_ssh)
    p_ssh_guide = ssh_sub.add_parser("guide", help="按 provider 给上传位置与要点")
    p_ssh_guide.add_argument("--url", default="")
    p_ssh_guide.add_argument("--host", default="")
    p_ssh_guide.set_defaults(func=cmd_ssh)
    p_ssh_test = ssh_sub.add_parser("test", help="真实握手验证权限")
    p_ssh_test.add_argument("--host", required=True)
    p_ssh_test.set_defaults(func=cmd_ssh)

    p_lsp = sub.add_parser("lsp", help="LSP 接入：出方案 / 确认后安装 / 三项验证")
    lsp_sub = p_lsp.add_subparsers(dest="lsp_command")
    p_lsp_plan = lsp_sub.add_parser("plan", help="探测客户端并出装法（不安装）")
    p_lsp_plan.add_argument("--system", default="")
    p_lsp_plan.set_defaults(func=cmd_lsp)
    p_lsp_install = lsp_sub.add_parser("install", help="确认后安装（未加 --yes 则拒绝）")
    p_lsp_install.add_argument("--client", required=True)
    p_lsp_install.add_argument("--yes", action="store_true")
    p_lsp_install.set_defaults(func=cmd_lsp)
    p_lsp_verify = lsp_sub.add_parser("verify", help="记录三项验证（全过才算通）")
    p_lsp_verify.add_argument("workspace", nargs="?", default=".")
    p_lsp_verify.add_argument("--client", required=True)
    p_lsp_verify.add_argument("--definition", action="store_true")
    p_lsp_verify.add_argument("--references", action="store_true")
    p_lsp_verify.add_argument("--diagnostics", action="store_true")
    p_lsp_verify.set_defaults(func=cmd_lsp)

    p_wiki = sub.add_parser("wiki", help="LLM Wiki：scaffold / grill / confirm / ingest / query / lint")
    wiki_sub = p_wiki.add_subparsers(dest="wiki_command")
    p_wiki_scaffold = wiki_sub.add_parser("scaffold", help="出 MODULE-MAP 草稿（draft）")
    p_wiki_scaffold.add_argument("workspace", nargs="?", default=".")
    p_wiki_scaffold.set_defaults(func=cmd_wiki)
    p_wiki_grill = wiki_sub.add_parser("grill", help="当前轮确认题（前沿）")
    p_wiki_grill.add_argument("workspace", nargs="?", default=".")
    p_wiki_grill.set_defaults(func=cmd_wiki)
    p_wiki_confirm = wiki_sub.add_parser("confirm", help="人签字：draft → confirmed；前沿未空则拒绝")
    p_wiki_confirm.add_argument("workspace", nargs="?", default=".")
    p_wiki_confirm.add_argument("--by", required=True, help="确认人")
    p_wiki_confirm.set_defaults(func=cmd_wiki)
    p_wiki_ingest = wiki_sub.add_parser("ingest", help="编译活页（draft 时拒绝）")
    p_wiki_ingest.add_argument("workspace", nargs="?", default=".")
    p_wiki_ingest.set_defaults(func=cmd_wiki)
    p_wiki_lint = wiki_sub.add_parser("lint", help="体检（只报告）")
    p_wiki_lint.add_argument("workspace", nargs="?", default=".")
    p_wiki_lint.set_defaults(func=cmd_wiki)
    p_wiki_query = wiki_sub.add_parser("query", help="双入口路由：入口 A 问架构 / 入口 B 问用法")
    p_wiki_query.add_argument("workspace", nargs="?", default=".")
    p_wiki_query.add_argument("--question", default="")
    p_wiki_query.add_argument("--entry", choices=(ENTRY_CODE, ENTRY_HOWTO), default="")
    p_wiki_query.set_defaults(func=cmd_wiki)
    return parser


def main(argv: list[str] | None = None) -> int:
    raw = list(argv) if argv is not None else sys.argv[1:]
    parser = build_parser()
    if not raw:
        parser.print_help()
        return 0
    args = parser.parse_args(raw)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

"""非技术用户的上手编排：能代做的直接做，只把必须人参与的收成一次提问。

设计原则
- 默认替用户执行(检查、生成、拉仓、建图、起 LSP 方案、起草 wiki)
- 涉及「改你机器」或「需要你身份」的，先请许可或用提问拿输入
- 每个提问都带 purpose，先说清为什么问、我们会拿它做什么
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from code_wiki.discover import discover_repos
from code_wiki.init import plan_commands, run_argv
from code_wiki.lsp import CLIENT_MATRIX, current_client, detect_clients, install as lsp_install
from code_wiki.wiki import scaffold_module_map
from code_wiki.proc import uses_ssh
from code_wiki.sshkey import (
    ensure_key,
    expand_clone_url,
    normalize_git_base,
    ssh_endpoint,
    ssh_keys_url,
    upload_guide,
    verify_connection,
)
from code_wiki.tools import probe_graph
from code_wiki.workspace import (
    discard_manifest_if_complete,
    inspect_workspace,
    prepare_workspace,
    write_workspace_file,
)

ASK_REPOS = "ask-repos"
ASK_PERMISSION = "ask-permission"
DO = "do"
READY = "ready"

# 我们会替用户做的事：说给非技术用户听，一件一件都是「替你做了」
WILL_DO_FOR_YOU = [
    "检查这台机器已经有什么，不用你记命令",
    "HTTPS 用本机已有 Git 凭据拉仓；只有 SSH 地址才准备密钥",
    "替你拉代码、建代码关系图",
    "替你出 LSP 配置方案",
    "替你起草模块地图草稿（要不要用它，你最后拍板）",
]


def _ask(qid: str, *, purpose: str, ask: str, fmt: str = "", example: str = "", options: list[str] | None = None) -> dict[str, Any]:
    body = {"id": qid, "purpose": purpose, "ask": ask}
    if fmt:
        body["format"] = fmt
    if example:
        body["example"] = example
    if options:
        body["options"] = options
    return body


def ask_repos_payload(*, git_base: str = "") -> dict[str, Any]:
    """空工作区：一次问完主机、仓库与认证。主机必须由项目显式给出。"""
    base = normalize_git_base(git_base)
    keys_page = ssh_keys_url(base)
    return {
        "kind": ASK_REPOS,
        "purpose": "要建代码知识库，先确认代码仓主机，再告诉我拉哪些仓。HTTPS 优先；内网没开 SSH 时不要生成密钥。",
        "willDoForYou": WILL_DO_FOR_YOU,
        "defaultGitBase": base,
        "questions": [
            _ask(
                "git-base",
                purpose="主机定了，HTTPS 凭据页和仓库路径才拼得出来。",
                ask=f"代码仓地址是 {base} 吗？不是的话请给出能打开仓库页的地址。",
                example=base,
            ),
            _ask(
                "repos",
                purpose="有了仓库我才能替你拉代码。主机确认后，路径可以不写域名。",
                ask="要纳入的仓库（有几个写几个，一行一个）",
                fmt="别名=路径 或 别名=完整地址",
                example=f"backend=group/backend.git\nfrontend={base}/group/frontend.git",
            ),
            _ask(
                "auth",
                purpose="私有仓先试本机已有的 Git 凭据。SSH 端口不通时改 HTTPS，Token 交给系统凭据管理器，不要把口令发给我。",
                ask=(
                    f"拉仓方式：本机 Git 已能访问就回「好了」。"
                    f"要用 SSH 时打开 {keys_page} 粘贴公钥；"
                    f"内网没开 SSH 时用 HTTPS，Token 页在 {base}/-/user_settings/personal_access_tokens（权限 read_repository）。"
                ),
            ),
        ],
        "afterYouAnswer": "按确认后的主机拼地址、拉仓、建图；失败的仓单独报，不重新问清单。",
        "note": "请不要把 Token 明文发我。",
    }


def _permission(command: list[str], *, purpose: str, effect: str, undo: str = "") -> dict[str, Any]:
    return {
        "kind": ASK_PERMISSION,
        "purpose": purpose,
        "command": " ".join(command),
        "effect": effect,
        "undo": undo,
        "ask": f"是否允许我执行：`{' '.join(command)}`？",
    }


def _has_private_key() -> bool:
    return (Path.home() / ".ssh" / "id_ed25519").exists()


def onboard(
    workspace_dir: str | Path,
    *,
    repos: list[dict[str, str]] | None = None,
    repos_file: str | Path | None = None,
    git_base: str = "",
    allow_ssh_generate: bool = False,
    allow_install: bool = False,
    dry_run: bool = False,
    which_fn=None,
    run_cmd: Callable[..., object] | None = None,
    run_git=None,
) -> dict[str, Any]:
    """探测后能代做的做完（写清单、拉仓、建图）；改机器或要人身份的先停下来问。"""
    root = Path(workspace_dir).resolve()
    inspect = inspect_workspace(root)
    repos_found = discover_repos(root)
    steps: list[dict[str, Any]] = []
    ask: dict[str, Any] | None = None
    # 1) 仓库
    if not repos_found and not repos and not repos_file:
        ask = ask_repos_payload(git_base=git_base)
        steps.append({"id": "repos", "state": "need-answer", "why": "没有仓库就无法建库"})
        return {
            "next": ASK_REPOS,
            "purpose": "建代码知识库的第一步：确认代码仓主机，再收仓库清单。",
            "ask": ask,
            "steps": steps,
            "workspace": str(root),
        }

    if repos:
        from code_wiki.proc import clone_url_for_git

        expanded = []
        for row in repos:
            url = expand_clone_url(row.get("url") or "", base=git_base)
            safe_url, stripped = clone_url_for_git(url)
            next_row = {**row, "url": safe_url}
            if stripped:
                next_row["strippedToken"] = True
            expanded.append(next_row)
        repos = expanded

    # 2) 认证：只有 SSH 地址才生成密钥。HTTPS 走系统凭据，不造用不上的 key。
    urls = [r.get("url", "") for r in (repos or [])]
    ssh_urls = [u for u in urls if uses_ssh(u)]
    endpoints = list(dict.fromkeys(ssh_endpoint(url) for url in ssh_urls))
    if endpoints:
        normalize_git_base(git_base)
        if not allow_ssh_generate and not _has_private_key():
            steps.append({
                "id": "ssh-key",
                "state": "need-permission",
                "detail": "SSH 地址才生成密钥；HTTPS 清单跳过这一步",
            })
            return {
                "next": ASK_PERMISSION,
                "ask": {
                    "kind": ASK_PERMISSION,
                    "ask": "清单是 SSH 地址。允许在本机生成密钥并复制公钥吗？HTTPS 清单不用这一步。",
                },
                "steps": steps,
                "workspace": str(root),
            }
        key_state = ensure_key(confirm=True, git_base=git_base, copy=True)
        if key_state.get("action") == "failed":
            steps.append({"id": "ssh-key", "state": "failed", "detail": key_state.get("error") or "生成密钥失败"})
            return {"next": ASK_PERMISSION, "ask": {"kind": ASK_PERMISSION, "ask": key_state.get("error") or "本机生成 SSH 密钥失败"}, "steps": steps, "workspace": str(root)}
        steps.append({"id": "ssh-key", "state": "done", "detail": key_state["action"]})
        failed_hosts = []
        for host, user, port in endpoints:
            guide = upload_guide(f'https://{host}', host=host)
            paste = guide.get("paste") or {}
            probe = verify_connection(host, user=user, port=port, run_cmd=run_cmd)
            steps.append({
                "id": "ssh-upload",
                "host": host,
                "user": user,
                "port": port,
                "state": "done" if probe["ok"] else "need-human",
                "ask": paste.get("ask"),
                "sshUrl": guide.get("sshUrl"),
                "copied": paste.get("copied"),
                "pubkey": paste.get("pubkey"),
                "guide": guide,
                "verified": probe["ok"],
            })
            if not probe["ok"]:
                failed_hosts.append(f'{user}@{host}:{port}')
        if failed_hosts:
            return {"next": ASK_PERMISSION, "ask": {
                "kind": ASK_PERMISSION,
                "ask": "请分别完成公钥授权并重新验证：" + "、".join(failed_hosts),
            }, "steps": steps, "workspace": str(root)}

    # 3) 引擎
    probe_kwargs = {"which_fn": which_fn} if which_fn else {}
    probe = probe_graph(**probe_kwargs)
    if not probe.ok:
        ask = {
            "kind": ASK_PERMISSION,
            "purpose": "建代码关系图要用 CodeGraph。源码不传出去，索引只放在工作区里。",
            "ask": (
                "可以帮你安装 CodeGraph 吗？Windows 请用 PowerShell 执行：\n"
                "npm i -g @colbymchenry/codegraph\n"
                "安装包：https://www.npmjs.com/package/@colbymchenry/codegraph\n"
                "github.com 不可达时不要用安装脚本。装完关掉默认遥测，再拉仓建图。"
            ),
            "effect": "在本机安装 CodeGraph，并关闭默认遥测",
            "undo": "之后可卸载 CodeGraph",
            "tool": "codegraph",
            "links": [
                "https://www.npmjs.com/package/@colbymchenry/codegraph",
                "https://github.com/colbymchenry/codegraph",
            ],
        }
        steps.append({"id": "engine", "state": "need-permission"})
        return {"next": ASK_PERMISSION, "ask": ask, "steps": steps, "workspace": str(root)}

    # 4) 拉仓 + 建图。清单是过程记录（repos.txt），拉齐就删。
    if repos and not repos_file and not dry_run:
        written = write_workspace_file(root, repositories=repos)
        repos_file = written["dest"]
    if not repos_found:
        steps.append({"id": "clone", "state": "will-do", "detail": "按清单逐仓拉取"})
        prepare_kwargs: dict[str, Any] = {"repos": repos, "repos_file": repos_file}
        if run_git is not None:
            prepare_kwargs["run_git"] = run_git
        if dry_run:
            plan = prepare_workspace(root, dry_run=True, **prepare_kwargs)
            steps[-1]["plan"] = [row["action"] for row in (plan.get("repos") or [])]
            return {"next": DO, "steps": steps, "workspace": str(root), "dryRun": True}
        prepared = prepare_workspace(root, **prepare_kwargs)
        steps[-1]["result"] = prepared["action"]
        stripped = [r for r in (prepared.get("repos") or []) if r.get("strippedToken")]
        if stripped:
            steps[-1]["strippedToken"] = True
            steps[-1]["ask"] = "清单里的 Token 已从 clone URL 剥掉。请到 PAT 页吊销旧 Token，改用凭据管理器。"
        failed = [r for r in (prepared.get("repos") or []) if r.get("action") == "failed"]
        if failed:
            steps[-1]["failed"] = [
                {"alias": r.get("alias") or "", "why": (r.get("error") or "").splitlines()[0][:200]}
                for r in failed
            ]
        repos_found = discover_repos(root)
    else:
        steps.append({"id": "clone", "state": "skipped", "detail": "工作区已有仓库"})

    if repos_found:
        steps.append({"id": "graph", "state": "will-do", "detail": "逐仓建立代码关系图"})
        if not dry_run:
            for item in plan_commands(repos_found):
                status, out = run_argv(item["argv"], run_cmd=run_cmd)
                if status != 0:
                    steps[-1]["state"] = "failed"
                    steps[-1]["detail"] = (out or "").strip()[:300]
                    break
            else:
                telemetry_status, telemetry_out = run_argv(["codegraph", "telemetry", "off"], run_cmd=run_cmd)
                if telemetry_status == 0:
                    steps[-1]["state"] = "done"
                    steps[-1]["telemetry"] = "off"
                else:
                    steps[-1]["state"] = "failed"
                    steps[-1]["detail"] = "telemetry off 失败：" + (telemetry_out or "请重试")[:200]

    # 5) LSP：能一键的代装；不能的只告诉人去客户端里打开
    installed_clients = detect_clients(which_fn=which_fn) if which_fn else detect_clients()
    preferred = current_client()
    detected = [row for row in installed_clients if row["client"] == preferred] if preferred else []
    lsp_step: dict[str, Any] = {
        "id": "lsp",
        "detected": [row["client"] for row in detected],
        "preferred": preferred,
        "available": [row["client"] for row in installed_clients] if not preferred else [],
    }
    if not detected:
        lsp_step["state"] = "need-client"
        lsp_step["ask"] = "还没识别到你正在用的编码工具。用 Cursor / Claude Code / Codex / OpenCode / 智脉 打开这个工作区后再说一声。"
    elif allow_install:
        done, manual = [], []
        for row in detected:
            client = row["client"]
            if CLIENT_MATRIX[client]["command"]:
                result = lsp_install(client, confirmed=True, run_cmd=run_cmd)
                done.append({"client": client, "installed": result.get("installed")})
            else:
                manual.append({"client": client, "how": CLIENT_MATRIX[client]["verify"]})
        lsp_step["state"] = "failed" if any(not row["installed"] for row in done) else "await-verification" if done else "manual"
        lsp_step["installed"] = done
        lsp_step["manual"] = manual
        label = CLIENT_MATRIX[detected[0]["client"]]["label"]
        lsp_step["ask"] = f"{label} 接入后，还要分别验证定义、引用和诊断；未验前不算已通。"
    else:
        lsp_step["state"] = "need-permission"
        label = CLIENT_MATRIX[detected[0]["client"]]["label"]
        lsp_step["ask"] = f"当前在用 {label}。可以帮你在这个工具里接上代码跳转（定义/引用）吗？"
    steps.append(lsp_step)

    # 6) LLM Wiki：现在就出模块地图草稿，确认仍要人名
    wiki_step: dict[str, Any] = {"id": "wiki", "state": "will-scaffold"}
    if not dry_run:
        drafted = scaffold_module_map(root)
        wiki_step["state"] = "draft"
        wiki_step["path"] = drafted.get("path")
        wiki_step["ask"] = "模块地图草稿已写好。确认人名字告诉我之后，才会当成以后必须遵守的划分。"
    steps.append(wiki_step)

    clone_failed = any(s.get("id") == "clone" and s.get("failed") for s in steps)
    if not dry_run and not clone_failed:
        discard_manifest_if_complete(root)
    graph_failed = any(s.get("id") == "graph" and s.get("state") == "failed" for s in steps)
    lsp_failed = lsp_step["state"] == "failed"

    return {
        "next": "retry-clone" if clone_failed else "retry-graph" if graph_failed else "retry-lsp" if lsp_failed else DO if dry_run else READY,
        "purpose": "能代做的已经做完；下面两件需要你点头或拍板。",
        "steps": steps,
        "workspace": str(root),
        "humanOnly": [
            "HTTPS：本机 Git 凭据能拉仓即可；SSH 才打开页面粘贴公钥",
            "模块地图确认时给出你的名字",
        ],
    }

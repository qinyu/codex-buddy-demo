"""SSH Key 与平台侧上传引导。

面向非技术用户：能代做的直接做（检查、生成、起 ssh-agent、验证连通），
只把「必须人点网页」的那一步留给人，并给出确切 URL 与要点。
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any, Callable

DEFAULT_KEY = "id_ed25519"

PROVIDER_UPLOAD: dict[str, dict[str, str]] = {
    "codeup": {
        "label": "阿里云云效 Codeup",
        "ssh_url": "https://codeup.aliyun.com/",
        "ssh_path": "右上角头像 → 个人设置 → SSH 公钥 → 添加公钥",
        "pat_path": "个人设置 → 访问令牌（优先用 SSH，可跳过）",
        "docs": "https://help.aliyun.com/zh/yunxiao/user-guide/configure-ssh-key",
    },
    "gitlab": {
        "label": "GitLab",
        "ssh_url": "{host}/-/user_settings/ssh_keys",
        "ssh_path": "个人头像 → Preferences/编辑个人资料 → SSH Keys → Add new key",
        "pat_path": "{host}/-/user_settings/personal_access_tokens（作用域至少 read_repository）",
        "docs": "https://docs.gitlab.com/user/ssh/",
    },
    "jihulab": {
        "label": "极狐 GitLab",
        "ssh_url": "{host}/-/user_settings/ssh_keys",
        "ssh_path": "个人头像 → 偏好设置 → SSH 密钥 → 添加新密钥",
        "pat_path": "{host}/-/user_settings/personal_access_tokens（作用域至少 read_repository）",
        "docs": "https://docs.gitlab.cn/docs/jh/user/ssh/",
    },
}


def normalize_git_base(url: str = "") -> str:
    """代码仓主机，无路径、无末尾斜杠。缺主机时阻断，不代入客户默认。"""
    raw = (url or "").strip()
    if not raw:
        raise ValueError("缺少显式代码仓主机")
    if raw.startswith("git@") and ":" in raw:
        host = raw.split("@", 1)[1].split(":", 1)[0]
        return f"https://{host}"
    if "://" not in raw:
        raw = f"https://{raw}"
    host = raw.split("//", 1)[1].split("/")[0].split("@")[-1]
    scheme = raw.split("://", 1)[0] or "https"
    return f"{scheme}://{host}"


def host_of(url: str = "") -> str:
    return normalize_git_base(url).split("//", 1)[1]


def ssh_keys_url(url: str = "") -> str:
    base = normalize_git_base(url)
    key = provider_of(base)
    spec = PROVIDER_UPLOAD[key]
    return spec["ssh_url"].format(host=base)


def expand_clone_url(entry: str, *, base: str = "") -> str:
    """清单行可以是完整 URL，也可以是 group/repo.git；后者拼到已确认的 base。"""
    text = (entry or "").strip()
    if not text:
        return ""
    if text.startswith("git@") or "://" in text:
        return text
    root = normalize_git_base(base)
    path = text.lstrip("/")
    if not path.endswith(".git"):
        path += ".git"
    return f"{root}/{path}"


def provider_of(url: str) -> str:
    """按主机名判 provider。判不出返回 gitlab（通用 SSH 流程一致）。"""
    host = (url or "").split("//")[-1].split("@")[-1].split("/")[0].lower()
    if "codeup" in host or "aliyun" in host:
        return "codeup"
    if "jihulab" in host:
        return "jihulab"
    return "gitlab"


def ssh_dir() -> Path:
    return Path.home() / ".ssh"


def key_paths(name: str = DEFAULT_KEY) -> tuple[Path, Path]:
    base = ssh_dir() / name
    return base, base.with_suffix(".pub")


def read_pubkey(name: str = DEFAULT_KEY) -> str | None:
    _, pub = key_paths(name)
    if not pub.exists():
        return None
    text = pub.read_text(encoding="utf-8").strip()
    return text or None


def ssh_config_hosts() -> str:
    cfg = ssh_dir() / "config"
    return cfg.read_text(encoding="utf-8") if cfg.exists() else ""


def _run(argv: list[str]) -> subprocess.CompletedProcess[str]:
    from code_wiki.proc import run_process

    return run_process(argv)


def copy_to_clipboard(text: str) -> bool:
    """把公钥放进系统剪贴板。失败不抛，调用方仍展示公钥正文。"""
    payload = (text or "").strip()
    if not payload:
        return False
    from code_wiki.proc import utf8_run_kwargs

    attempts = (
        ["pbcopy"],
        ["wl-copy"],
        ["xclip", "-selection", "clipboard"],
        ["clip"],
        ["powershell", "-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
    )
    for argv in attempts:
        try:
            result = subprocess.run(
                argv,
                input=payload + "\n",
                check=False,
                **utf8_run_kwargs(),
            )
        except OSError:
            continue
        if result.returncode == 0:
            return True
    return False


def generate_key(
    *,
    name: str = DEFAULT_KEY,
    comment: str = "code-wiki",
    passphrase: str = "",
    run_cmd: Callable[..., subprocess.CompletedProcess[str]] | None = None,
    write: bool = True,
) -> dict[str, Any]:
    """生成 ED25519 密钥。默认不设口令 —— 便于无人值守；要口令就给 passphrase。

    私钥只落本机 ~/.ssh，绝不回显、绝不写进清单或日志。
    """
    priv, pub = key_paths(name)
    if priv.exists():
        return {"created": False, "private": str(priv), "public": str(pub), "reason": "已存在，复用"}
    argv = ["ssh-keygen", "-t", "ed25519", "-C", comment, "-f", str(priv), "-N", passphrase]
    if not write:
        return {"created": False, "argv": argv, "dryRun": True}
    runner = run_cmd or _run
    ssh_dir().mkdir(parents=True, exist_ok=True, mode=0o700)
    result = runner(argv)
    if result.returncode != 0:
        return {"created": False, "error": (result.stderr or "").strip(), "argv": argv}
    os.chmod(priv, 0o600)
    return {
        "created": True,
        "private": str(priv),
        "public": str(pub),
        "passphrase": bool(passphrase),
        "pubkey": read_pubkey(name),
    }


def prepare_paste(
    *,
    git_base: str,
    pubkey: str | None = None,
    copied: bool | None = None,
) -> dict[str, Any]:
    """给人看的一步：公钥已在剪贴板（或正文里），去页面粘贴。不出现命令。"""
    page = ssh_keys_url(git_base)
    text = pubkey if pubkey is not None else read_pubkey()
    copied_flag = copy_to_clipboard(text) if copied is None else copied
    if copied_flag:
        ask = f"公钥已复制。打开 {page}，粘贴保存即可。"
    else:
        ask = f"请复制下面这行公钥，打开 {page} 粘贴保存：\n{text or '（尚未生成公钥）'}"
    return {
        "sshUrl": page,
        "pubkey": text,
        "copied": copied_flag,
        "ask": ask,
        "note": "私钥只留在这台电脑里，不用复制私钥。",
    }


def ensure_key(
    *,
    name: str = DEFAULT_KEY,
    confirm: bool = True,
    passphrase: str = "",
    run_cmd: Callable[..., subprocess.CompletedProcess[str]] | None = None,
    copy: bool = True,
    git_base: str,
) -> dict[str, Any]:
    """检查 → 缺则按 ed25519 直接生成。对人只给公钥和粘贴页，不暴露命令。"""
    normalize_git_base(git_base)
    pub_text = read_pubkey(name)
    priv, pub = key_paths(name)
    if priv.exists() and pub_text:
        paste = prepare_paste(git_base=git_base, pubkey=pub_text, copied=False if copy is False else None)
        return {
            "action": "reuse",
            "private": str(priv),
            "public": str(pub),
            "pubkey": pub_text,
            "copied": paste["copied"],
            "paste": paste,
            "message": "本机已有 SSH 密钥，公钥已为你准备好，去页面粘贴即可。",
        }
    generated = generate_key(name=name, passphrase=passphrase, run_cmd=run_cmd)
    if not generated.get("created"):
        return {"action": "failed", **generated}
    pubkey = generated.get("pubkey") or read_pubkey(name)
    paste = prepare_paste(git_base=git_base, pubkey=pubkey, copied=False if copy is False else None)
    return {
        "action": "generated",
        **generated,
        "copied": paste["copied"],
        "paste": paste,
        "message": "已在本机生成 SSH 密钥。公钥已复制，打开页面粘贴保存即可。",
    }


def upload_guide(url: str, *, host: str = "") -> dict[str, Any]:
    """按 provider 给上传位置与要点；主机来自已确认的 base URL。"""
    base = normalize_git_base(url or host)
    key = provider_of(base)
    spec = PROVIDER_UPLOAD[key]
    ssh_url = spec["ssh_url"].format(host=base)
    pat_path = spec["pat_path"].format(host=host_of(base))
    pubkey = read_pubkey()
    paste = prepare_paste(git_base=base, pubkey=pubkey)
    return {
        "provider": key,
        "label": spec["label"],
        "sshUrl": ssh_url,
        "sshSteps": spec["ssh_path"],
        "patPath": pat_path,
        "docs": spec["docs"],
        "pubkey": pubkey,
        "copied": paste["copied"],
        "paste": paste,
        "note": "公钥已为你准备好，打开页面粘贴保存即可。",
    }


def ssh_endpoint(url: str) -> tuple[str, str, int]:
    parsed = urlsplit(url if '://' in url else 'ssh://' + url.replace(':', '/', 1))
    host = parsed.hostname or ''
    user = parsed.username or 'git'
    if not host or host.startswith('-') or user.startswith('-'):
        raise ValueError('SSH 地址缺少有效主机或用户')
    return host, user, parsed.port or 22


def verify_connection(host: str, *, user: str = 'git', port: int = 22, run_cmd: Callable[..., subprocess.CompletedProcess[str]] | None = None) -> dict[str, Any]:
    """真实握手验证权限。不加 StrictHostKeyChecking=no，避免 MITM。"""
    runner = run_cmd or _run
    result = runner(["ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-p", str(port), f"{user}@{host}"])
    text = ((result.stdout or "") + (result.stderr or "")).strip()
    ok = "successfully authenticated" in text or "welcome" in text.lower()
    return {"host": host, "ok": ok, "message": text.splitlines()[0] if text else "无输出"}

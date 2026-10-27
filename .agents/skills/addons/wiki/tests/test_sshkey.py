import subprocess
from pathlib import Path

import pytest

from code_wiki.sshkey import (
    PROVIDER_UPLOAD,
    copy_to_clipboard,
    ensure_key,
    expand_clone_url,
    generate_key,
    key_paths,
    normalize_git_base,
    prepare_paste,
    provider_of,
    read_pubkey,
    ssh_keys_url,
    verify_connection,
    upload_guide,
)


@pytest.fixture(autouse=True)
def fake_home(tmp_path, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setattr(Path, "home", staticmethod(lambda: home))
    return home


def _ok(argv=None, **kw):
    return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()


def _seed_key():
    priv, pub = key_paths()
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("PRIVATE", encoding="utf-8")
    pub.write_text("ssh-ed25519 AAAA test@example\n", encoding="utf-8")
    return priv, pub


def test_missing_git_base_is_rejected() -> None:
    with pytest.raises(ValueError, match="显式"):
        normalize_git_base("")
    with pytest.raises(ValueError, match="显式"):
        normalize_git_base(" ")
    with pytest.raises(ValueError, match="显式"):
        expand_clone_url("group/backend.git")
    with pytest.raises(ValueError, match="显式"):
        ssh_keys_url()


def test_blank_git_base_has_no_key_or_clipboard_side_effects(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr("code_wiki.sshkey.read_pubkey", lambda *a, **k: calls.append("read") or "ssh-ed25519 AAAA")
    monkeypatch.setattr("code_wiki.sshkey.generate_key", lambda **k: calls.append("generate") or {"created": True})
    monkeypatch.setattr("code_wiki.sshkey.copy_to_clipboard", lambda text: calls.append("copy") or True)
    for blank in ("", " ", "\t"):
        with pytest.raises(ValueError, match="显式"):
            ensure_key(git_base=blank)
        with pytest.raises(ValueError, match="显式"):
            prepare_paste(git_base=blank)
    assert calls == []


def test_given_git_base_keeps_protocol_normalization() -> None:
    assert normalize_git_base("https://git.example.cn/") == "https://git.example.cn"
    assert normalize_git_base("git.example.cn/group/backend.git") == "https://git.example.cn"
    assert normalize_git_base("git@git.example.cn:group/backend.git") == "https://git.example.cn"
    assert expand_clone_url("group/backend.git", base="https://git.example.cn") == "https://git.example.cn/group/backend.git"
    assert expand_clone_url("https://other.example/a.git", base="https://git.example.cn") == "https://other.example/a.git"
    assert ssh_keys_url("https://git.example.cn") == "https://git.example.cn/-/user_settings/ssh_keys"


def test_provider_detection() -> None:
    assert provider_of("https://codeup.aliyun.com/g/r.git") == "codeup"
    assert provider_of("git@jihulab.com:g/r.git") == "jihulab"
    assert provider_of("https://gitlab.example.com/g/r.git") == "gitlab"
    assert provider_of("") == "gitlab"


def test_ensure_generates_without_asking(monkeypatch) -> None:
    monkeypatch.setattr("code_wiki.sshkey.copy_to_clipboard", lambda text: True)
    calls = []

    def run(argv, **kw):
        calls.append(argv)
        priv, pub = key_paths()
        priv.parent.mkdir(parents=True, exist_ok=True)
        priv.write_text("PRIVATE", encoding="utf-8")
        pub.write_text("ssh-ed25519 AAAA fresh\n", encoding="utf-8")
        return _ok()

    result = ensure_key(run_cmd=run, git_base="https://git.example.cn")
    assert result["action"] == "generated"
    assert result["created"] is True
    assert result["copied"] is True
    assert "ssh-keygen" not in result["paste"]["ask"]
    assert "git.example.cn" in result["paste"]["sshUrl"]
    assert "粘贴" in result["paste"]["ask"]
    assert calls[0][:3] == ["ssh-keygen", "-t", "ed25519"]


def test_ensure_reuses_existing_key(monkeypatch) -> None:
    monkeypatch.setattr("code_wiki.sshkey.copy_to_clipboard", lambda text: True)
    _seed_key()
    result = ensure_key(git_base="https://git.example.cn")
    assert result["action"] == "reuse"
    assert result["pubkey"].startswith("ssh-ed25519")
    assert result["copied"] is True
    assert "粘贴" in result["paste"]["ask"]


def test_prepare_paste_has_no_command() -> None:
    paste = prepare_paste(git_base="https://git.example.cn", pubkey="ssh-ed25519 AAAA x", copied=True)
    assert "ssh-keygen" not in paste["ask"]
    assert paste["copied"] is True
    assert paste["sshUrl"].endswith("/ssh_keys")


def test_generate_records_passphrase_flag() -> None:
    def run(argv, **kw):
        priv, pub = key_paths()
        priv.write_text("P", encoding="utf-8")
        pub.write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")
        return _ok()

    result = generate_key(passphrase="s3cret", run_cmd=run)
    assert result["passphrase"] is True


def test_generate_surfaces_failure() -> None:
    def run(argv, **kw):
        return type("R", (), {"returncode": 1, "stdout": "", "stderr": "boom"})()

    result = generate_key(run_cmd=run)
    assert result["created"] is False
    assert "boom" in result["error"]


def test_upload_guide_uses_real_host_and_permissions() -> None:
    guide = upload_guide("https://gitlab.example.com/g/r.git")
    assert guide["provider"] == "gitlab"
    assert "gitlab.example.com" in guide["sshUrl"]
    assert "read_repository" in guide["patPath"]
    assert guide["docs"].startswith("https://")
    assert "粘贴" in guide["note"]


def test_upload_guide_for_codeup() -> None:
    guide = upload_guide("https://codeup.aliyun.com/g/r.git")
    assert guide["provider"] == "codeup"
    assert guide["sshUrl"] == PROVIDER_UPLOAD["codeup"]["ssh_url"]
    assert "SSH 公钥" in guide["sshSteps"]


def test_verify_connection_does_not_disable_host_check() -> None:
    seen = {}

    def run(argv, **kw):
        seen["argv"] = argv
        return type("R", (), {"returncode": 1, "stdout": "", "stderr": "Welcome to GitLab, @x!"})()

    result = verify_connection("gitlab.example.com", run_cmd=run)
    assert result["ok"] is True
    joined = " ".join(seen["argv"])
    assert "StrictHostKeyChecking=no" not in joined
    assert "BatchMode=yes" in joined


def test_read_pubkey_none_when_absent() -> None:
    assert read_pubkey() is None

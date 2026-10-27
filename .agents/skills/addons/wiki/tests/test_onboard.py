from pathlib import Path

import pytest

from code_wiki.onboard import (
    ASK_PERMISSION,
    ASK_REPOS,
    READY,
    ask_repos_payload,
    onboard,
)


@pytest.fixture(autouse=True)
def fake_home(tmp_path, monkeypatch):
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setattr(Path, "home", staticmethod(lambda: home))
    return home


def _git_repo(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    (path / ".git").mkdir()
    (path / "README.md").write_text(path.name, encoding="utf-8")
    return path


def _ok(argv=None, **kw):
    return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()


def test_ask_repos_payload_is_one_round_with_purpose() -> None:
    with pytest.raises(ValueError, match="显式"):
        ask_repos_payload()
    base = "https://git.example.cn"
    payload = ask_repos_payload(git_base=base)
    assert payload["kind"] == ASK_REPOS
    assert payload["purpose"]
    assert payload["defaultGitBase"] == base
    ids = [q["id"] for q in payload["questions"]]
    assert ids[0] == "git-base"
    assert base in payload["questions"][0]["ask"]
    assert "吗？" in payload["questions"][0]["ask"]
    assert len(payload["questions"]) <= 3
    for q in payload["questions"]:
        assert q["purpose"], f"{q['id']} 缺 purpose"
        assert q["ask"]
    keys_q = next(q for q in payload["questions"] if q["id"] == "auth")
    assert base in keys_q["ask"]
    assert "personal_access_tokens" in keys_q["ask"]
    assert "HTTPS" in keys_q["ask"]


def test_empty_workspace_asks_repos(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="显式"):
        onboard(tmp_path)
    result = onboard(tmp_path, git_base="https://git.example.cn")
    assert result["next"] == ASK_REPOS
    assert result["ask"]["kind"] == ASK_REPOS
    assert result["purpose"]
    assert result["ask"]["questions"][0]["id"] == "git-base"


def test_blank_git_base_stops_before_key_side_effects(tmp_path: Path, monkeypatch) -> None:
    calls = []
    monkeypatch.setattr('code_wiki.onboard.ensure_key', lambda **kw: calls.append('ensure') or {'action': 'generated'})
    monkeypatch.setattr('code_wiki.sshkey.read_pubkey', lambda *a, **k: calls.append('read'))
    monkeypatch.setattr('code_wiki.sshkey.generate_key', lambda **kw: calls.append('generate'))
    monkeypatch.setattr('code_wiki.sshkey.copy_to_clipboard', lambda text: calls.append('copy') or True)
    with pytest.raises(ValueError, match='显式'):
        onboard(
            tmp_path,
            repos=[{'alias': 'be', 'url': 'git@gitlab.example.com:g/be.git', 'path': 'be'}],
            allow_ssh_generate=True,
            git_base=' ',
        )
    with pytest.raises(ValueError, match='显式'):
        onboard(
            tmp_path,
            repos=[{'alias': 'be', 'url': 'group/be.git', 'path': 'be'}],
            allow_ssh_generate=True,
            git_base='',
        )
    assert calls == []
    assert not (Path.home() / '.ssh' / 'id_ed25519').exists()


def test_https_onboard_skips_ssh_key(tmp_path: Path) -> None:
    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "https://gitlab.example.com/g/be.git", "path": "be", "branch": ""}],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok,
        run_git=_ok,
    )
    steps = {s["id"]: s for s in result["steps"]}
    assert "ssh-key" not in steps
    assert "ssh-upload" not in steps
    assert not (Path.home() / ".ssh" / "id_ed25519").exists()


def test_missing_key_generates_and_asks_only_to_paste(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("code_wiki.sshkey.copy_to_clipboard", lambda text: True)

    def run(argv=None, **kw):
        if argv and argv[:2] == ["ssh-keygen", "-t"]:
            priv = Path.home() / ".ssh" / "id_ed25519"
            priv.parent.mkdir(parents=True, exist_ok=True)
            priv.write_text("PRIVATE", encoding="utf-8")
            priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA fresh\n", encoding="utf-8")
            return _ok()
        return _ok()

    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "git@gitlab.example.com:g/be.git", "path": "be", "branch": ""}],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=run,
        allow_ssh_generate=True,
        git_base="https://git.example.cn",
    )
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["ssh-key"]["state"] == "done"
    assert steps["ssh-key"]["detail"] == "generated"
    assert steps["ssh-upload"]["copied"] is True
    assert "粘贴" in steps["ssh-upload"]["ask"]
    assert "ssh-keygen" not in (steps["ssh-upload"]["ask"] or "")
    assert (Path.home() / ".ssh" / "id_ed25519").exists()


def test_existing_key_skips_generation_ask(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr('code_wiki.onboard.verify_connection', lambda host, **kw: {'ok': False})
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")
    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "git@gitlab.example.com:g/be.git", "path": "be", "branch": ""}],
        allow_ssh_generate=True,
        git_base="https://git.example.cn",
    )
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["ssh-key"]["detail"] == "reuse"
    assert "粘贴" in (steps["ssh-upload"].get("ask") or "")
    assert steps["ssh-upload"]["state"] == "need-human"
    assert "gitlab.example.com" in steps["ssh-upload"]["guide"]["sshUrl"]


def test_ssh_url_keeps_user_port_and_checks_separate_endpoints(tmp_path: Path, monkeypatch):
    monkeypatch.setattr('code_wiki.onboard._has_private_key', lambda: True)
    monkeypatch.setattr('code_wiki.onboard.ensure_key', lambda **kw: {'action': 'reuse'})
    calls = []
    def run(argv, **kw):
        calls.append(argv)
        return _ok()
    result = onboard(tmp_path, repos=[
        {'alias': 'a', 'url': 'ssh://alice@gitlab.example.com:2222/g/a.git', 'path': 'a'},
        {'alias': 'b', 'url': 'ssh://git@gitlab.example.com/g/b.git', 'path': 'b'},
    ], run_cmd=run, git_base='https://gitlab.example.com')
    assert result['next'] == ASK_PERMISSION
    assert calls[0][-3:] == ['-p', '2222', 'alice@gitlab.example.com']
    assert calls[1][-3:] == ['-p', '22', 'git@gitlab.example.com']
    uploads = [s for s in result['steps'] if s['id'] == 'ssh-upload']
    assert all(s['sshUrl'] == 'https://gitlab.example.com/-/user_settings/ssh_keys' for s in uploads)


@pytest.mark.parametrize('second_ok', [False, True])
def test_ssh_verifies_each_host_before_clone(tmp_path: Path, monkeypatch, second_ok) -> None:
    monkeypatch.setattr('code_wiki.onboard._has_private_key', lambda: True)
    monkeypatch.setattr('code_wiki.onboard.ensure_key', lambda **kw: {'action': 'reuse', 'paste': {}})
    monkeypatch.setattr('code_wiki.onboard.upload_guide', lambda url, host: {'sshUrl': host, 'paste': {}})
    checked, cloned = [], []

    def verify(host, **kw):
        checked.append(host)
        return {'ok': host == 'codeup.aliyun.com' or second_ok}

    monkeypatch.setattr('code_wiki.onboard.verify_connection', verify)

    def clone(args):
        cloned.append(args)
        _git_repo(Path(args[-1]))
        return _ok()

    result = onboard(tmp_path, repos=[
        {'alias': 'a', 'url': 'git@codeup.aliyun.com:g/a.git', 'path': 'a'},
        {'alias': 'b', 'url': 'git@gitlab.example.com:g/b.git', 'path': 'b'},
        {'alias': 'c', 'url': 'git@codeup.aliyun.com:g/c.git', 'path': 'c'},
    ], run_cmd=_ok, run_git=clone, which_fn=lambda cmd, path=None: f'/bin/{cmd}', git_base='https://git.example.cn')
    assert checked == ['codeup.aliyun.com', 'gitlab.example.com']
    if second_ok:
        assert len(cloned) == 3
    else:
        assert cloned == []
        assert result['next'] == ASK_PERMISSION
        assert not any(s['id'] == 'graph' for s in result['steps'])


def test_onboard_dry_run_does_not_write_repo_list(tmp_path: Path) -> None:
    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "https://git.example.test/group/be.git", "path": "be"}],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        dry_run=True,
    )
    assert result["next"] != READY
    assert not (tmp_path / "repos.txt").exists()


def test_onboard_does_not_install_path_only_clients(tmp_path: Path) -> None:
    _git_repo(tmp_path / "be")
    result = onboard(
        tmp_path, which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok, allow_install=True,
    )
    lsp = next(s for s in result["steps"] if s["id"] == "lsp")
    assert lsp["state"] == "need-client"
    assert not lsp.get("installed")


def test_missing_engine_triggers_install_permission(tmp_path: Path) -> None:
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")
    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "https://gitlab.example.com/g/be.git", "path": "be", "branch": ""}],
        which_fn=lambda cmd, path=None: None,
    )
    assert result["next"] == ASK_PERMISSION
    assert result["ask"].get("tool") == "codegraph"
    assert "command" not in result["ask"]
    assert "CodeGraph" in result["ask"]["ask"]
    assert "npm i -g @colbymchenry/codegraph" in result["ask"]["ask"]
    assert result["ask"]["links"][0].startswith("https://www.npmjs.com/")


def test_full_run_reports_ready_and_human_only(tmp_path: Path) -> None:
    _git_repo(tmp_path / "be")
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    result = onboard(
        tmp_path,
        run_cmd=_ok,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
    )
    assert result["next"] == READY
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["clone"]["state"] == "skipped"          # 已有仓库
    assert steps["graph"]["state"] == "done"
    assert steps["graph"].get("telemetry") == "off"
    assert steps["lsp"]["state"] == "need-client"
    assert "编码工具" in (steps["lsp"].get("ask") or "")
    assert steps["wiki"]["state"] == "draft"
    assert (tmp_path / "docs/project-wiki/MODULE-MAP.md").exists()
    assert not (tmp_path / "docs/project-wiki/CONTEXT.md").exists()
    assert len(result["humanOnly"]) == 2
    assert any("HTTPS" in item or "公钥" in item for item in result["humanOnly"])
    assert any("名字" in item for item in result["humanOnly"])


def test_onboard_short_path_uses_confirmed_base(tmp_path: Path) -> None:
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")
    seen = []

    def fake_git(args):
        seen.append(args)
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "group/be.git", "path": "be", "branch": ""}],
        git_base="https://git.example.cn",
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok,
        run_git=fake_git,
    )
    assert any("https://git.example.cn/group/be.git" in args for args in seen)


def test_onboard_writes_workspace_json_before_clone(tmp_path: Path) -> None:
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")

    def fake_git(args):
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "https://git.example.test/group/be.git", "path": "be", "branch": ""}],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok,
        run_git=fake_git,
    )
    assert (tmp_path / "be" / ".git").is_dir()
    assert result["next"] == READY
    assert not (tmp_path / "repos.txt").exists(), "拉齐后过程清单应删掉"
    assert not (tmp_path / "workspace.json").exists()


def test_onboard_partial_clone_keeps_manifest_for_retry(tmp_path: Path) -> None:
    priv = Path.home() / ".ssh" / "id_ed25519"
    priv.parent.mkdir(parents=True, exist_ok=True)
    priv.write_text("P", encoding="utf-8")
    priv.with_suffix(".pub").write_text("ssh-ed25519 AAAA x\n", encoding="utf-8")

    def fake_git(args):
        target = Path(args[-1])

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        if str(target).endswith("/be"):
            R.returncode = 128
            R.stderr = "fatal: could not read Username"
            return R()
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return R()

    result = onboard(
        tmp_path,
        repos=[
            {"alias": "be", "url": "https://git.example.test/group/be.git", "path": "be", "branch": ""},
            {"alias": "fe", "url": "https://git.example.test/group/fe.git", "path": "fe", "branch": ""},
        ],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok,
        run_git=fake_git,
    )
    text = (tmp_path / "repos.txt").read_text(encoding="utf-8")
    assert "be=https://git.example.test/group/be.git" in text
    assert "fe=https://git.example.test/group/fe.git" in text
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["clone"]["failed"]
    assert steps["clone"]["failed"][0]["alias"] == "be"
    assert (tmp_path / "fe" / ".git").is_dir()
    assert not (tmp_path / "be").exists()


def test_onboard_strips_embedded_https_token(tmp_path: Path) -> None:
    seen = []

    def fake_git(args):
        seen.append(args)
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return _ok()

    result = onboard(
        tmp_path,
        repos=[{"alias": "be", "url": "https://oauth2:secret-token@git.example.test/group/be.git", "path": "be", "branch": ""}],
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_cmd=_ok,
        run_git=fake_git,
    )
    assert seen[0][-2] == "https://git.example.test/group/be.git"
    assert "secret-token" not in " ".join(seen[0])
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["clone"]["strippedToken"] is True
    assert "吊销" in steps["clone"]["ask"]
    assert "secret-token" not in str(result)


def test_failed_graph_and_telemetry_are_not_ready(tmp_path: Path) -> None:
    _git_repo(tmp_path / "be")

    def fail_graph(argv=None, **kw):
        if argv and argv[:2] == ["codegraph", "init"]:
            return type("R", (), {"returncode": 1, "stdout": "", "stderr": "index boom"})()
        return _ok()

    result = onboard(tmp_path, run_cmd=fail_graph, which_fn=lambda cmd, path=None: "/bin/codegraph")
    assert result["next"] != READY
    assert next(s for s in result["steps"] if s["id"] == "graph")["state"] == "failed"

    def fail_telemetry(argv=None, **kw):
        if argv and argv[:3] == ["codegraph", "telemetry", "off"]:
            return type("R", (), {"returncode": 1, "stdout": "", "stderr": "telemetry boom"})()
        return _ok()

    result = onboard(tmp_path, run_cmd=fail_telemetry, which_fn=lambda cmd, path=None: "/bin/codegraph")
    graph = next(s for s in result["steps"] if s["id"] == "graph")
    assert result["next"] != READY
    assert graph.get("telemetry") != "off"
    assert "telemetry" in graph["detail"]


def test_current_client_install_failure_is_not_done(tmp_path: Path, monkeypatch) -> None:
    _git_repo(tmp_path / "be")
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / "codex"))

    def run(argv=None, **kw):
        if argv and argv[:2] == ["serena", "setup"]:
            return type("R", (), {"returncode": 1, "stderr": "setup failed", "stdout": ""})()
        return _ok()

    result = onboard(tmp_path, run_cmd=run, which_fn=lambda cmd, path=None: f"/bin/{cmd}", allow_install=True)
    lsp = next(s for s in result["steps"] if s["id"] == "lsp")
    assert lsp["detected"] == ["codex"]
    assert lsp["state"] == "failed"
    assert result["next"] != READY


def test_engine_failure_is_reported_not_raised(tmp_path: Path) -> None:
    _git_repo(tmp_path / "be")

    def run(argv=None, **kw):
        if argv and argv[:2] == ["codegraph", "init"]:
            return type("R", (), {"returncode": 1, "stdout": "", "stderr": "index boom"})()
        return _ok()

    result = onboard(tmp_path, run_cmd=run, which_fn=lambda cmd, path=None: "/bin/codegraph")
    steps = {s["id"]: s for s in result["steps"]}
    assert steps["graph"]["state"] == "failed"
    assert "boom" in steps["graph"]["detail"]

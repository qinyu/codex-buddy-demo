from code_wiki.proc import clone_url_for_git, resolve_argv, run_process, uses_ssh, wrap_windows_argv


def test_wrap_windows_cmd_shim() -> None:
    argv = wrap_windows_argv(["codegraph", "init", r"D:\repo"], r"C:\nvm4w\nodejs\codegraph.cmd")
    assert argv[:3] == ["cmd", "/c", r"C:\nvm4w\nodejs\codegraph.cmd"]
    assert argv[-2:] == ["init", r"D:\repo"]


def test_wrap_leaves_unix_binaries() -> None:
    assert wrap_windows_argv(["codegraph", "query"], "/opt/homebrew/bin/codegraph") == [
        "/opt/homebrew/bin/codegraph",
        "query",
    ]


def test_resolve_argv_uses_which() -> None:
    wrapped = resolve_argv(
        ["codegraph", "init"],
        which_fn=lambda cmd, path=None: r"C:\Tools\codegraph.cmd" if cmd == "codegraph" else None,
    )
    assert wrapped[0] == "cmd"
    assert wrapped[2].endswith("codegraph.cmd")


def test_https_token_is_stripped() -> None:
    clean, stripped = clone_url_for_git("https://oauth2:secret-token@git.example.test/group/tpm.git")
    assert stripped is True
    assert clean == "https://git.example.test/group/tpm.git"
    assert "secret-token" not in clean
    assert uses_ssh("https://git.example.test/group/tpm.git") is False
    assert uses_ssh("git@git.example.test:group/tpm.git") is True


def test_run_process_passes_timeout(monkeypatch) -> None:
    seen = {}

    def fake_run(**kwargs):
        seen.update(kwargs)
        return None

    monkeypatch.setattr("code_wiki.proc.subprocess.run", fake_run)
    run_process(["echo", "ok"], timeout=5)
    assert seen["timeout"] == 5
    seen.clear()
    run_process(["echo", "ok"])
    assert "timeout" not in seen

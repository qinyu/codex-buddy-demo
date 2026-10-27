from code_wiki.tools import format_hint, probe_commands, probe_graph, which


def test_probe_reports_missing_without_calling_installers() -> None:
    probe = probe_commands(["git", "codegraph"], which_fn=lambda cmd, path=None: None)
    assert probe.ok is False
    assert probe.missing == ["git", "codegraph"]
    hint = probe.hint(system="darwin")
    assert "codegraph" in hint
    assert "github.com/colbymchenry/codegraph" in hint
    assert "npmjs.com/package/@colbymchenry/codegraph" in hint


def test_codegraph_install_hint_names_the_tool() -> None:
    hint = probe_graph(which_fn=lambda cmd, path=None: None).hint(system="darwin")
    assert "github.com/colbymchenry/codegraph" in hint


def test_probe_graph_finds_codegraph() -> None:
    probe = probe_graph(which_fn=lambda cmd, path=None: "/bin/codegraph" if cmd == "codegraph" else None)
    assert probe.ok is True
    assert probe.found["codegraph"] == "/bin/codegraph"


def test_which_uses_path_env(monkeypatch, tmp_path) -> None:
    exe = tmp_path / "git"
    exe.write_text("#!/bin/sh\n", encoding="utf-8")
    exe.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path))
    assert which("git") == str(exe)


def test_format_hint_stable_sections() -> None:
    text = format_hint(["git"], system="win32")
    assert "## git" in text
    assert "windows：" in text
    assert "mac：" in text


def test_windows_codegraph_hint_leads_with_npm() -> None:
    hint = format_hint(["codegraph"], system="win32")
    assert "npm i -g @colbymchenry/codegraph" in hint
    assert hint.index("npm i -g") < hint.index("github.com/colbymchenry/codegraph")

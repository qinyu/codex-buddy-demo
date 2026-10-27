"""Implicit entry must never start the legacy preparation pipeline."""
import pytest
from code_wiki.cli import main


def test_no_command_only_prints_help(monkeypatch, capsys):
    def forbidden(*args, **kwargs):
        pytest.fail("implicit ensure executed")
    monkeypatch.setattr("code_wiki.cli.ensure", forbidden)
    assert main([]) == 0
    assert "usage:" in capsys.readouterr().out


@pytest.mark.parametrize("argv", [["qurey"], ["some-workspace"]])
def test_unknown_command_does_not_prepare(argv, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("implicit ensure executed")
    monkeypatch.setattr("code_wiki.cli.ensure", forbidden)
    with pytest.raises(SystemExit) as exc:
        main(argv)
    assert exc.value.code == 2


def test_explicit_ensure_remains_available(monkeypatch):
    calls = []
    monkeypatch.setattr("code_wiki.cli.ensure", lambda workspace, **kw: calls.append(workspace) or {"next": "ready"})
    assert main(["ensure", "some-workspace"]) == 0
    assert calls == ["some-workspace"]

import json
from pathlib import Path

import pytest

from code_wiki.lsp import (
    CLIENT_MATRIX,
    LspError,
    cli_plan,
    current_client,
    detect_clients,
    install,
    lsp_plan,
    read_verification,
    record_verification,
)


def test_matrix_covers_four_clients_with_verified_fields() -> None:
    assert {"claude-code", "codex", "opencode", "cursor"}.issubset(CLIENT_MATRIX)
    assert "code-vt" in CLIENT_MATRIX
    for key, spec in CLIENT_MATRIX.items():
        for field in ("bin", "label", "mechanism", "command", "manual", "verify", "canAttachExternalServer"):
            assert field in spec, f"{key} 缺 {field}"


def test_external_server_capability_matches_verified_facts() -> None:
    # Claude Code 与 OpenCode 能挂外部 server；Codex 走 MCP；Cursor 只能开关内置
    assert CLIENT_MATRIX["claude-code"]["canAttachExternalServer"] is True
    assert CLIENT_MATRIX["opencode"]["canAttachExternalServer"] is True
    assert CLIENT_MATRIX["codex"]["canAttachExternalServer"] is True
    assert CLIENT_MATRIX["cursor"]["canAttachExternalServer"] is False


def test_current_client_reads_env(monkeypatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE", raising=False)
    monkeypatch.delenv("CODEX_HOME", raising=False)
    monkeypatch.delenv("CURSOR_SESSION", raising=False)
    monkeypatch.delenv("OPENCODE", raising=False)
    assert current_client(env={}) is None
    assert current_client(env={"CURSOR_SESSION": "1"}) == "cursor"
    assert current_client(env={"CLAUDECODE": "1"}) == "claude-code"
    assert current_client(env={"CODE_VT": "1"}) == "code-vt"


def test_detect_clients_uses_path_only() -> None:
    found = detect_clients(which_fn=lambda cmd, path=None: f"/bin/{cmd}" if cmd in {"cursor", "claude"} else None)
    assert {row["client"] for row in found} == {"claude-code", "cursor"}
    assert detect_clients(which_fn=lambda cmd, path=None: None) == []


def test_plan_for_cursor_states_the_confusion_guard() -> None:
    plan = lsp_plan("cursor")
    assert plan["canAttachExternalServer"] is False
    assert any("不对外暴露查询接口" in note for note in plan["notes"])
    assert any("两套索引" in note for note in plan["notes"])
    assert "Enable LSPs for Worktrees" in plan["manual"]


def test_plan_for_claude_code_mentions_marketplace_has_lsp() -> None:
    plan = lsp_plan("claude-code")
    assert plan["oneLiner"] == "serena setup claude-code"
    assert any("官方插件市场**有** LSP 插件" in note for note in plan["notes"])


def test_plan_for_codex_says_no_builtin() -> None:
    plan = lsp_plan("codex")
    assert any("未内置 LSP" in note for note in plan["notes"])
    assert plan["oneLiner"] == "serena setup codex"


def test_plan_for_code_vt_uses_restricted_network_jdtls() -> None:
    plan = lsp_plan("code-vt", system="win32")
    assert plan["canAttachExternalServer"] is True
    assert any("Eclipse" in note for note in plan["notes"])
    assert any("摘掉" in note for note in plan["notes"])
    assert "PowerShell" in plan["manual"]
    assert plan["serenaInstall"][0].startswith("uv tool install -p 3.13.15")


def test_plan_rejects_unknown_client() -> None:
    with pytest.raises(LspError) as exc:
        lsp_plan("vscode")
    assert exc.value.code == 1


def test_cli_plan_reports_detected_and_gate() -> None:
    result = cli_plan(which_fn=lambda cmd, path=None: "/bin/x" if cmd == "codex" else None)
    assert result["detected"] == []
    assert {row["client"] for row in result["installed"]} == {"codex"}
    assert len(result["plans"]) == 0
    assert "人确认" in result["gate"]


def test_plan_prefers_current_client_over_other_installed_clients(monkeypatch) -> None:
    monkeypatch.setenv("CODEX_HOME", "/tmp/codex")
    result = cli_plan(which_fn=lambda cmd, path=None: f"/bin/{cmd}")
    assert [row["client"] for row in result["detected"]] == ["codex"]
    assert [plan["client"] for plan in result["plans"]] == ["codex"]


def test_cli_plan_detects_all_four_without_order_dependence() -> None:
    result = cli_plan(which_fn=lambda cmd, path=None: f"/bin/{cmd}")
    assert result["detected"] == []
    assert {row["client"] for row in result["installed"]} == {"claude-code", "codex", "opencode", "cursor"}


def test_install_requires_confirmation() -> None:
    with pytest.raises(LspError) as exc:
        install("claude-code")
    assert exc.value.code == 3


def test_install_runs_one_liner_when_confirmed() -> None:
    calls = []

    def run(argv):
        calls.append(argv)
        return type("R", (), {"returncode": 0, "stderr": ""})()

    result = install("codex", confirmed=True, run_cmd=run)
    assert result["installed"] is True
    assert calls == [["serena", "setup", "codex"]]


def test_install_without_one_liner_hands_over_manual() -> None:
    result = install("cursor", confirmed=True)
    assert result["installed"] is False
    assert result["next"] == "manual"
    assert "Code Intelligence" in result["manual"]


def test_verification_requires_all_three_kinds(tmp_path: Path) -> None:
    with pytest.raises(LspError) as exc:
        record_verification(tmp_path, client="codex", results={"definition": True})
    assert "缺项" in str(exc.value)


def test_verification_passes_only_when_all_three_true(tmp_path: Path) -> None:
    partial = record_verification(
        tmp_path, client="codex", results={"definition": True, "references": True, "diagnostics": False}
    )
    assert partial["passed"] is False
    assert partial["verdict"] == "未通（三项须全过）"

    full = record_verification(
        tmp_path,
        client="codex",
        results={"definition": True, "references": True, "diagnostics": True},
    )
    assert full["passed"] is True
    assert full["verdict"] == "已通"
    on_disk = read_verification(tmp_path)
    assert on_disk["passed"] is True
    assert json.loads((tmp_path / "docs/project-wiki/lsp-verification.json").read_text(encoding="utf-8"))["client"] == "codex"

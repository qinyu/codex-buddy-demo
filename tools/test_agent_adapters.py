#!/usr/bin/env python3
"""Offline contract tests for the verified Agent Hub adapters."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
AGENT_HUB = ROOT / "integrations" / "agent-hub"
sys.path.insert(0, str(ROOT / "plugins" / "codex-usage-stick" / "scripts"))

import hook_entry  # noqa: E402


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


install_presence = load_module("install_presence_under_test", AGENT_HUB / "install_presence.py")
hermes = load_module("hermes_adapter_under_test", AGENT_HUB / "hermes" / "__init__.py")


class CursorInstallerTests(unittest.TestCase):
    def test_should_preserve_unrelated_hooks_and_replace_old_install_if_config_exists(self) -> None:
        # Arrange
        with self.subTest("temporary cursor configuration"):
            import tempfile

            with tempfile.TemporaryDirectory() as temp_dir:
                hooks_path = Path(temp_dir) / "hooks.json"
                hooks_path.write_text(
                    json.dumps(
                        {
                            "version": 1,
                            "hooks": {
                                "sessionStart": [
                                    {"command": "agent_hub_notify.py --old", "type": "command"},
                                    {"command": "keep-me", "type": "command"},
                                    "unknown-entry",
                                ]
                            },
                        }
                    )
                )

                # Act
                with patch.object(install_presence, "CURSOR_HOOKS", hooks_path):
                    with patch("builtins.print"):
                        install_presence.install_cursor()

                # Assert
                saved = json.loads(hooks_path.read_text())
                entries = saved["hooks"]["sessionStart"]
                self.assertEqual(entries[0]["command"], "keep-me")
                self.assertEqual(entries[1], "unknown-entry")
                self.assertEqual(entries[2]["command"], install_presence.cursor_command())
                self.assertEqual(len(entries), 3)

    def test_should_install_each_supported_cursor_event_once_if_config_is_empty(self) -> None:
        # Arrange
        import tempfile

        with tempfile.TemporaryDirectory() as temp_dir:
            hooks_path = Path(temp_dir) / "hooks.json"

            # Act
            with patch.object(install_presence, "CURSOR_HOOKS", hooks_path):
                with patch("builtins.print"):
                    install_presence.install_cursor()

            # Assert
            saved = json.loads(hooks_path.read_text())
            self.assertEqual(set(saved["hooks"]), set(install_presence.CURSOR_EVENTS))
            self.assertTrue(all(len(saved["hooks"][event]) == 1 for event in install_presence.CURSOR_EVENTS))


class HermesAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        hermes._SESSION_STATE.clear()

    def tearDown(self) -> None:
        hermes._SESSION_STATE.clear()

    def test_should_emit_start_once_and_include_session_and_working_directory(self) -> None:
        # Arrange
        emitted: list[dict] = []
        hooks = {}

        class FakeContext:
            def register_hook(self, name, callback):
                hooks[name] = callback

        with patch.object(hermes, "_emit", side_effect=emitted.append):
            hermes.register(FakeContext())

            # Act
            hooks["on_session_start"](session_id="session-7", cwd="/work/alpha")
            hooks["on_session_start"](session_id="session-7", cwd="/work/alpha")

        # Assert
        self.assertEqual(
            emitted,
            [
                {
                    "session_id": "hermes-session-7",
                    "cwd": "/work/alpha",
                    "hook_event_name": "SessionStart",
                }
            ],
        )

    def test_should_emit_end_for_the_matching_session_if_finalize_is_called(self) -> None:
        # Arrange
        emitted: list[dict] = []
        hooks = {}

        class FakeContext:
            def register_hook(self, name, callback):
                hooks[name] = callback

        with patch.object(hermes, "_emit", side_effect=emitted.append):
            hermes.register(FakeContext())
            hooks["on_session_start"](session_id="session-a", cwd="/work/a")
            hooks["on_session_start"](session_id="session-b", cwd="/work/b")

            # Act
            hooks["on_session_finalize"](session_id="session-a", cwd="/work/a")
            hooks["on_session_start"](session_id="session-a", cwd="/work/a")

        # Assert
        self.assertEqual(
            [(item["session_id"], item["hook_event_name"]) for item in emitted],
            [
                ("hermes-session-a", "SessionStart"),
                ("hermes-session-b", "SessionStart"),
                ("hermes-session-a", "SessionEnd"),
                ("hermes-session-a", "SessionStart"),
            ],
        )


class PiAdapterContractTests(unittest.TestCase):
    def test_should_register_lifecycle_and_activity_hooks_with_stable_session_id(self) -> None:
        # Arrange
        source = (AGENT_HUB / "pi" / "index.ts").read_text()

        # Act
        registrations = {
            event: f'pi.on("{event}"' in source
            for event in (
                "session_start",
                "session_shutdown",
                "before_agent_start",
                "tool_call",
                "tool_result",
                "agent_end",
            )
        }

        # Assert
        self.assertTrue(all(registrations.values()))
        self.assertIn('session_id: `pi-${sessionId}`', source)
        self.assertIn("cwd: cwd ?? undefined", source)


class CodexHookAdapterTests(unittest.TestCase):
    def test_should_forward_stable_session_and_cwd_from_hook_payload(self) -> None:
        # Arrange
        fake_socket = MagicMock()
        fake_socket_instance = fake_socket.return_value.__enter__.return_value
        fake_socket_instance.makefile.return_value.__enter__.return_value.readline.return_value = b"{}\n"
        payload = json.dumps(
            {"session_id": "codex-session-8", "cwd": "/work/beta", "hook_event_name": "SessionStart"}
        )

        # Act
        with patch.object(hook_entry.socket, "socket", fake_socket):
            hook_entry.notify_agent_hub("fallback-event", payload)

        # Assert
        sent = fake_socket_instance.sendall.call_args.args[0]
        envelope = json.loads(sent.decode("utf-8"))
        self.assertEqual(envelope["session_id"], "codex-session-8")
        self.assertEqual(envelope["cwd"], "/work/beta")
        self.assertEqual(envelope["hook_event_name"], "SessionStart")
        self.assertEqual(envelope["client_kind"], "codex")


if __name__ == "__main__":
    unittest.main()

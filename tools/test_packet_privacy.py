#!/usr/bin/env python3
"""Offline contract tests for the Agent Hub BLE packet privacy boundary."""

from __future__ import annotations

import json
import unittest

from codex_usage_ble_bridge import UsageSnapshot


def _snapshot() -> UsageSnapshot:
    return UsageSnapshot(
        tokens=0,
        primary=10,
        secondary=20,
        primary_resets_at=0,
        secondary_resets_at=0,
        source=__file__,
        event_ts=None,
        limit_id="openai",
        limit_name="OpenAI",
        provider="openai",
        label="OpenAI",
        provider_index=0,
        provider_count=1,
        primary_label="mo",
        meter_count=1,
    )


class AgentHubPacketPrivacyTests(unittest.TestCase):
    def test_should_send_only_session_display_fields_if_roster_contains_private_source_data(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {
                "agent": "Codex",
                "project": "alpha",
                "short_id": "cx-01",
                "state": "busy",
                "cwd": "/Users/dev/private/alpha",
                "prompt": "PROMPT-SECRET-9f1a",
                "credential": "CREDENTIAL-SECRET-4b2c",
                "raw_hook": {"payload": "RAW-HOOK-SECRET-7d3e"},
            },
            {
                "agent": "Pi",
                "project": "beta",
                "short_id": "pi-02",
                "state": "attention",
                "cwd": "/Users/dev/private/beta",
            },
        ]

        # Act
        packet = snapshot.packet("busy")
        serialized = json.dumps(packet, ensure_ascii=False)

        # Assert
        self.assertEqual(
            packet["sessions"],
            [
                {"agent": "Codex", "project": "alpha", "short_id": "cx-01", "state": "busy"},
                {"agent": "Pi", "project": "beta", "short_id": "pi-02", "state": "attention"},
            ],
        )
        self.assertEqual(packet["sessions_total"], 2)
        self.assertNotIn("sessions_page_index", packet)
        self.assertNotIn("sessions_page_count", packet)
        self.assertEqual(packet["agent"], "CODEX")
        self.assertEqual(packet["agent_id"], "codex")
        self.assertEqual(packet["provider"], "openai")
        self.assertEqual(packet["primary"], 10)
        self.assertEqual(packet["secondary"], 20)
        self.assertEqual(packet["provider_index"], 0)
        self.assertEqual(packet["provider_count"], 1)
        self.assertNotIn("/Users/dev/private", serialized)
        self.assertNotIn("PROMPT-SECRET-9f1a", serialized)
        self.assertNotIn("CREDENTIAL-SECRET-4b2c", serialized)
        self.assertNotIn("RAW-HOOK-SECRET-7d3e", serialized)

    def test_should_show_unknown_labels_and_state_if_display_fields_are_missing_or_invalid(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {"agent": None, "project": None, "short_id": None, "state": []},
        ]

        # Act
        packet = snapshot.packet("busy")

        # Assert
        self.assertEqual(
            packet["sessions"],
            [{"agent": "AGENT", "project": "未知项目", "short_id": "未知会话", "state": "unknown"}],
        )
        self.assertEqual(packet["sessions_total"], 1)
        self.assertNotIn("sessions_page_index", packet)
        self.assertNotIn("sessions_page_count", packet)

    def test_should_send_empty_roster_if_no_sessions_are_active(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = []

        # Act
        packet = snapshot.packet("idle")

        # Assert
        self.assertEqual(packet["sessions"], [])
        self.assertEqual(packet["sessions_total"], 0)

    def test_should_use_default_page_if_page_index_is_invalid(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {"agent": "Codex", "project": "alpha", "short_id": f"s-{index}", "state": "idle"}
            for index in range(10)
        ]
        snapshot.sessions_page_index = "invalid"  # type: ignore[assignment]

        # Act
        packet = snapshot.packet("idle")

        # Assert
        self.assertEqual(packet["sessions_page_index"], 0)
        self.assertEqual([item["short_id"] for item in packet["sessions"]], [f"s-{index}" for index in range(8)])

    def test_should_disambiguate_truncated_session_ids_if_prefixes_collide(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {"agent": "Codex", "project": "alpha", "short_id": "session-1234-A", "state": "busy"},
            {"agent": "Codex", "project": "alpha", "short_id": "session-1234-B", "state": "busy"},
        ]

        # Act
        packet = snapshot.packet("busy")
        short_ids = [item["short_id"] for item in packet["sessions"]]

        # Assert
        self.assertNotEqual(short_ids[0], short_ids[1])
        self.assertTrue(all(len(short_id) <= 12 for short_id in short_ids))

    def test_should_keep_project_and_session_short_id_visible_if_labels_are_truncated(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {
                "agent": "A" * 40,
                "project": "project-name-that-is-much-longer-than-display-limit",
                "short_id": "session-identifier-longer-than-display-limit",
                "state": "busy",
            },
        ]

        # Act
        packet = snapshot.packet("busy")
        session = packet["sessions"][0]

        # Assert
        self.assertEqual(len(session["agent"]), 12)
        self.assertLessEqual(len(session["project"]), 24)
        self.assertLessEqual(len(session["short_id"]), 12)
        self.assertNotEqual(session["project"], "未知项目")
        self.assertNotEqual(session["short_id"], "未知会话")
        self.assertEqual(session["state"], "busy")

    def test_should_report_multiple_pages_if_roster_exceeds_display_page(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {
                "agent": f"Agent {index}",
                "project": f"project-{index}",
                "short_id": f"s-{index}",
                "state": "idle",
            }
            for index in range(10)
        ]

        # Act
        packet = snapshot.packet("idle")

        # Assert
        self.assertEqual(len(packet["sessions"]), 8)
        self.assertEqual(packet["sessions_total"], 10)
        self.assertEqual(packet["sessions_page_index"], 0)
        self.assertEqual(packet["sessions_page_count"], 2)
        self.assertEqual(packet["sessions"][-1]["short_id"], "s-7")
        self.assertEqual(packet["sessions"][0]["project"], "project-0")

    def test_should_return_next_session_page_if_page_index_advances(self) -> None:
        # Arrange
        snapshot = _snapshot()
        snapshot.sessions = [
            {
                "agent": f"Agent {index}",
                "project": f"project-{index}",
                "short_id": f"s-{index}",
                "state": "idle",
            }
            for index in range(10)
        ]
        snapshot.sessions_page_index = 1

        # Act
        packet = snapshot.packet("idle")

        # Assert
        self.assertEqual([item["short_id"] for item in packet["sessions"]], ["s-8", "s-9"])
        self.assertEqual(packet["sessions_page_index"], 1)
        self.assertEqual(packet["sessions_page_count"], 2)

    def test_should_keep_legacy_packet_fields_if_roster_is_absent(self) -> None:
        # Arrange
        snapshot = _snapshot()

        # Act
        packet = snapshot.packet("idle")

        # Assert
        self.assertNotIn("sessions", packet)
        self.assertEqual(packet["state"], "idle")
        self.assertEqual(packet["agent"], "CODEX")
        self.assertEqual(packet["agent_id"], "codex")
        self.assertEqual(packet["agent_index"], 0)
        self.assertEqual(packet["agent_count"], 1)
        self.assertEqual(packet["provider"], "openai")
        self.assertEqual(packet["provider_index"], 0)
        self.assertEqual(packet["provider_count"], 1)
        self.assertEqual(packet["primary"], 10)
        self.assertEqual(packet["secondary"], 20)


if __name__ == "__main__":
    unittest.main()

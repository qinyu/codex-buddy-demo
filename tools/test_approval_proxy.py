#!/usr/bin/env python3
"""Offline tests for Codex approval prompt identity and queue ordering."""

from __future__ import annotations

import argparse
import asyncio
import unittest

from codex_usage_ble_bridge import CodexApprovalProxy


class FakeBle:
    def __init__(self) -> None:
        self.packets: list[dict[str, object]] = []

    async def write_json(self, packet: dict[str, object]) -> str:
        self.packets.append(packet)
        return ""


class FakeStdin:
    def __init__(self) -> None:
        self.lines: list[bytes] = []

    def write(self, data: bytes) -> None:
        self.lines.append(data)

    async def drain(self) -> None:
        return None


class FakeProcess:
    def __init__(self) -> None:
        self.stdin = FakeStdin()
        self.returncode = None


class ApprovalProxyQueueTests(unittest.IsolatedAsyncioTestCase):
    def make_proxy(self) -> tuple[CodexApprovalProxy, FakeBle]:
        ble = FakeBle()
        args = argparse.Namespace(verbose=False)
        proxy = CodexApprovalProxy(args, ble)  # type: ignore[arg-type]
        proxy.proc = FakeProcess()  # type: ignore[assignment]
        return proxy, ble

    async def enqueue_request(self, proxy: CodexApprovalProxy, rpc_id: str) -> None:
        await proxy._handle_server_message(
            {
                "id": rpc_id,
                "method": "item/commandExecution/requestApproval",
                "params": {"command": ["echo", rpc_id]},
            }
        )

    async def test_should_ignore_device_decision_for_non_active_request(self) -> None:
        proxy, _ = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")
        await self.enqueue_request(proxy, "rpc-second")

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a2", "decision": "accept"}
        )

        self.assertEqual(proxy.pending_order, ["a1", "a2"])
        self.assertEqual(proxy.active_prompt_id, "a1")
        self.assertEqual(proxy.proc.stdin.lines, [])  # type: ignore[union-attr]

    async def test_should_send_decision_only_to_matching_active_rpc(self) -> None:
        proxy, ble = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")
        await self.enqueue_request(proxy, "rpc-second")

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "accept"}
        )

        self.assertEqual(
            proxy.proc.stdin.lines,  # type: ignore[union-attr]
            [b'{"jsonrpc":"2.0","id":"rpc-first","result":{"decision":"accept"}}\n'],
        )
        self.assertEqual(proxy.pending_order, ["a2"])
        self.assertEqual(proxy.active_prompt_id, "a2")
        self.assertEqual(ble.packets[-1]["prompt"]["id"], "a2")  # type: ignore[index]

    async def test_should_route_cancel_only_to_current_request_as_deny(self) -> None:
        proxy, _ = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "cancel"}
        )

        self.assertEqual(
            proxy.proc.stdin.lines,  # type: ignore[union-attr]
            [b'{"jsonrpc":"2.0","id":"rpc-first","result":{"decision":"cancel"}}\n'],
        )
        self.assertEqual(proxy.pending, {})
        self.assertIsNone(proxy.active_prompt_id)

    async def test_should_ignore_duplicate_decision_without_advancing_next_request(self) -> None:
        proxy, _ = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")
        await self.enqueue_request(proxy, "rpc-second")
        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "cancel"}
        )

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "accept"}
        )

        self.assertEqual(proxy.pending_order, ["a2"])
        self.assertEqual(proxy.active_prompt_id, "a2")
        self.assertEqual(len(proxy.proc.stdin.lines), 1)  # type: ignore[union-attr]

    async def test_should_keep_active_request_pending_for_unknown_decision(self) -> None:
        proxy, _ = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "maybe"}
        )

        self.assertEqual(proxy.pending_order, ["a1"])
        self.assertEqual(proxy.active_prompt_id, "a1")
        self.assertEqual(proxy.proc.stdin.lines, [])  # type: ignore[union-attr]

    async def test_should_expire_timed_out_hook_request_without_allowing(self) -> None:
        proxy, _ = self.make_proxy()

        decision = await proxy.request_hook_permission({"tool_name": "Shell"}, timeout=0)

        self.assertIsNone(decision)
        self.assertEqual(proxy.pending, {})
        self.assertEqual(proxy.pending_order, [])
        self.assertIsNone(proxy.active_prompt_id)
        self.assertEqual(proxy.proc.stdin.lines, [])  # type: ignore[union-attr]

    async def test_should_not_send_decision_when_proxy_is_disconnected(self) -> None:
        proxy, _ = self.make_proxy()
        await self.enqueue_request(proxy, "rpc-first")
        proxy.proc.returncode = 1  # type: ignore[union-attr]

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "a1", "decision": "accept"}
        )

        self.assertFalse(proxy.enabled)
        self.assertEqual(proxy.pending_order, [])
        self.assertEqual(proxy.proc.stdin.lines, [])  # type: ignore[union-attr]

    async def test_should_ignore_unsupported_non_codex_approval_method(self) -> None:
        proxy, ble = self.make_proxy()

        await proxy._handle_server_message(
            {"id": "foreign-1", "method": "foreignAgent/requestApproval", "params": {}}
        )

        self.assertEqual(proxy.pending, {})
        self.assertIsNone(proxy.active_prompt_id)
        self.assertEqual(ble.packets, [])
        self.assertEqual(proxy.proc.stdin.lines, [])  # type: ignore[union-attr]

    async def test_should_ignore_approval_without_request_id(self) -> None:
        proxy, ble = self.make_proxy()

        await proxy._handle_server_message(
            {
                "method": "item/commandExecution/requestApproval",
                "params": {"command": "echo unsafe"},
            }
        )

        self.assertEqual(proxy.pending, {})
        self.assertIsNone(proxy.active_prompt_id)
        self.assertEqual(ble.packets, [])

    async def test_should_return_deny_for_hook_cancel_decision(self) -> None:
        proxy, _ = self.make_proxy()
        request = asyncio.create_task(
            proxy.request_hook_permission({"tool_name": "Shell"}, timeout=10)
        )
        await asyncio.sleep(0)

        await proxy.handle_device_message(
            {"cmd": "permission", "id": "h1", "decision": "cancel"}
        )
        decision = await request

        self.assertEqual(decision, "deny")
        self.assertEqual(proxy.pending, {})
        self.assertEqual(proxy.pending_order, [])


if __name__ == "__main__":
    unittest.main()

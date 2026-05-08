"""Recovery path: engine-WS drops mid-turn → reconnect + retry once."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(fastapi_app, tracer_log_dir, monkeypatch: pytest.MonkeyPatch):
    app, fake = fastapi_app
    from app import main as main_mod

    monkeypatch.setattr(main_mod, "STATUS_FRAME_THROTTLE_SECONDS", 0.0)
    with TestClient(app) as tc:
        yield tc, fake, main_mod


def test_disconnect_error_triggers_recovery_and_retry(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    tc, fake, main_mod = client
    # First chat call fails with a disconnect-classified error; second succeeds.
    call_count = {"n": 0}
    original = fake.chat

    async def flaky_chat(*, token, question, on_sse=None):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("Server is not connected")
        return await original(token=token, question=question, on_sse=on_sse)

    fake.chat = flaky_chat  # type: ignore[assignment]
    fake.chat_response = {"answers": ["recovered reply"]}

    # Track recovery: bump the start_coding_agent stub to return new tokens.
    async def restart() -> dict[str, str]:
        return {"chat": "tk_chat_v2", "webhook": "tk_webhook_v2"}

    monkeypatch.setattr(main_mod, "start_coding_agent", restart)

    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "go"})
        # The first frame is the "connection lost — restarting pipeline…" status.
        first = ws.receive_json()
        assert first["type"] == "status"
        assert "connection lost" in first["text"].lower()
        terminal = ws.receive_json()
    assert terminal == {"type": "reply", "text": "recovered reply"}
    assert call_count["n"] == 2


def test_recovery_failure_emits_error_frame(client, monkeypatch: pytest.MonkeyPatch) -> None:
    tc, fake, main_mod = client
    fake.chat_side_effect = RuntimeError("Pipeline is not currently running")

    async def restart_fails() -> dict[str, str]:
        raise RuntimeError("recovery exploded")

    monkeypatch.setattr(main_mod, "start_coding_agent", restart_fails)

    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "go"})
        # Status: "connection lost…" then a terminal error.
        frames = []
        for _ in range(4):
            frames.append(ws.receive_json())
            if frames[-1]["type"] in {"reply", "error", "cancelled"}:
                break
    assert frames[-1]["type"] == "error"


def test_non_disconnect_error_skips_recovery(client, monkeypatch: pytest.MonkeyPatch) -> None:
    tc, fake, main_mod = client
    fake.chat_side_effect = ValueError("bad payload")

    restart_invocations = {"n": 0}

    async def restart() -> dict[str, str]:
        restart_invocations["n"] += 1
        return {"chat": "tk_chat_v2", "webhook": "tk_webhook_v2"}

    monkeypatch.setattr(main_mod, "start_coding_agent", restart)

    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "go"})
        msg = ws.receive_json()
    assert msg["type"] == "error"
    assert "bad payload" in msg["message"]
    assert restart_invocations["n"] == 0  # no recovery attempted

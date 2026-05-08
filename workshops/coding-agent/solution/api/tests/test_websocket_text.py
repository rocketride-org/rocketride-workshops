"""WebSocket text-turn integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(fastapi_app, tracer_log_dir, monkeypatch: pytest.MonkeyPatch):
    app, fake = fastapi_app
    # Disable status throttle so emitted status frames are deterministic.
    from app import main as main_mod

    monkeypatch.setattr(main_mod, "_STATUS_THROTTLE_SECONDS", 0.0)
    with TestClient(app) as tc:
        yield tc, fake


def test_text_turn_yields_reply_frame(client) -> None:
    tc, fake = client
    fake.chat_response = {"answers": ["here is the answer"]}
    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "what's up"})
        msg = ws.receive_json()
        assert msg == {"type": "reply", "text": "here is the answer"}
    # Verify chat token was used, not webhook.
    assert fake.chat_calls
    assert fake.chat_calls[0]["token"] == "tk_chat"


def test_empty_text_dropped_silently(client) -> None:
    tc, fake = client
    fake.chat_response = {"answers": ["after-second"]}
    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": ""})  # empty -> ignored
        ws.send_json({"type": "text", "text": "real one"})
        msg = ws.receive_json()
        assert msg["type"] == "reply"
        assert msg["text"] == "after-second"
    # Only one chat call: the second message.
    assert len(fake.chat_calls) == 1


def test_status_frame_emitted_for_thinking_sse(client) -> None:
    tc, fake = client
    fake.chat_sse_events = [("thinking", {"message": "calling tool"})]
    fake.chat_response = {"answers": ["done"]}
    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "hi"})
        first = ws.receive_json()
        second = ws.receive_json()
    assert first == {"type": "status", "text": "calling tool"}
    assert second == {"type": "reply", "text": "done"}


def test_engine_error_surfaces_as_error_frame(client) -> None:
    tc, fake = client
    fake.chat_side_effect = RuntimeError("engine bad")
    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_json({"type": "text", "text": "x"})
        msg = ws.receive_json()
    assert msg["type"] == "error"
    assert "engine bad" in msg["message"]


def test_malformed_json_frame_ignored(client) -> None:
    tc, fake = client
    fake.chat_response = {"answers": ["ok"]}
    with tc.websocket_connect("/api/ws/chat") as ws:
        ws.send_text("{not json")  # malformed
        ws.send_json({"type": "text", "text": "real"})
        msg = ws.receive_json()
    assert msg["type"] == "reply"

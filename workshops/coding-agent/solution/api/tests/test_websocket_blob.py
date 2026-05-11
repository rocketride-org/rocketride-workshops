"""WebSocket blob state-machine integration tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(fastapi_app, tracer_log_dir, monkeypatch: pytest.MonkeyPatch):
    app, fake = fastapi_app
    from app import main as main_mod

    monkeypatch.setattr(main_mod, "STATUS_FRAME_THROTTLE_SECONDS", 0.0)
    # Lower the size cap so over-cap tests are cheap.
    monkeypatch.setattr(main_mod, "MAX_BLOB_BYTES", 32)
    with TestClient(app) as tc:
        yield tc, fake


def _drain_until_terminal(ws):
    """Status frames precede the terminal frame; collect until reply/error/cancelled."""
    frames = []
    while True:
        msg = ws.receive_json()
        frames.append(msg)
        if msg["type"] in {"reply", "error", "cancelled"}:
            return frames


class TestAudioBlob:
    def test_audio_only_routes_to_send_not_send_files(self, client) -> None:
        tc, fake = client
        fake.send_response = {"answers": ["transcribed reply"]}
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-start", "channel": "audio", "mimetype": "audio/webm"})
            ws.send_bytes(b"\x00\x01\x02")
            ws.send_json({"type": "blob-end"})
            terminal = _drain_until_terminal(ws)[-1]
        assert terminal == {"type": "reply", "text": "transcribed reply"}
        # Routed via send_blob → client.send (not client.send_files).
        assert len(fake.send_calls) == 1
        assert fake.send_calls[0]["mimetype"] == "audio/webm"
        assert fake.send_calls[0]["data"] == b"\x00\x01\x02"
        assert fake.send_calls[0]["token"] == "tk_webhook"
        assert not fake.send_files_calls

    def test_image_only_routes_to_send(self, client) -> None:
        tc, fake = client
        fake.send_response = {"answers": ["ocr reply"]}
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json(
                {
                    "type": "blob-start",
                    "channel": "image",
                    "mimetype": "image/png",
                    "name": "foo.png",
                }
            )
            ws.send_bytes(b"PNGDATA")
            ws.send_json({"type": "blob-end"})
            terminal = _drain_until_terminal(ws)[-1]
        assert terminal["type"] == "reply"
        call = fake.send_calls[0]
        assert call["mimetype"] == "image/png"
        assert call["objinfo"] == {"mimetype": "image/png", "name": "foo.png"}


class TestCombinedBlob:
    def test_blob_with_text_routes_to_send_files(self, client) -> None:
        tc, fake = client
        fake.send_files_response = [{}, {"answers": ["combined reply"]}]
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json(
                {
                    "type": "blob-start",
                    "channel": "image",
                    "mimetype": "image/jpeg",
                    "text": "describe what you see",
                }
            )
            ws.send_bytes(b"JPEG")
            ws.send_json({"type": "blob-end"})
            terminal = _drain_until_terminal(ws)[-1]
        assert terminal == {"type": "reply", "text": "combined reply"}
        # send_files called instead of send.
        assert len(fake.send_files_calls) == 1
        assert not fake.send_calls
        files = fake.send_files_calls[0]["files"]
        # Two files: caption + blob.
        assert len(files) == 2
        assert files[0][2] == "text/plain"
        assert files[1][2] == "image/jpeg"


class TestErrors:
    def test_invalid_channel_emits_error(self, client) -> None:
        tc, _ = client
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-start", "channel": "video", "mimetype": "video/mp4"})
            msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "channel" in msg["message"].lower()

    def test_missing_mimetype_emits_error(self, client) -> None:
        tc, _ = client
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-start", "channel": "audio"})
            msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "mimetype" in msg["message"].lower()

    def test_oversized_blob_emits_error_and_resets(self, client) -> None:
        tc, fake = client
        # Cap is 32 bytes (set in fixture).
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-start", "channel": "audio", "mimetype": "audio/webm"})
            ws.send_bytes(b"x" * 64)  # over cap
            err = ws.receive_json()
            assert err["type"] == "error"
            assert "cap" in err["message"].lower()
            # Recovery: a fresh blob-start should work after the cap-reset.
            fake.send_response = {"answers": ["recovered"]}
            ws.send_json({"type": "blob-start", "channel": "audio", "mimetype": "audio/webm"})
            ws.send_bytes(b"ok")
            ws.send_json({"type": "blob-end"})
            terminal = _drain_until_terminal(ws)[-1]
        assert terminal["type"] == "reply"
        assert terminal["text"] == "recovered"

    def test_empty_blob_buffer_emits_error(self, client) -> None:
        tc, _ = client
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-start", "channel": "audio", "mimetype": "audio/webm"})
            # No binary frame.
            ws.send_json({"type": "blob-end"})
            msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "empty" in msg["message"].lower()

    def test_stray_binary_without_pending_is_dropped(self, client) -> None:
        tc, fake = client
        fake.send_response = {"answers": ["after-stray"]}
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_bytes(b"orphan-bytes")  # dropped silently
            # Subsequent text still works.
            ws.send_json({"type": "text", "text": "hi"})
            msg = ws.receive_json()
        assert msg["type"] == "reply"
        # Only the text turn's send call should exist — no blob send was triggered
        # by the stray binary frame. Both text and blob now share client.send,
        # so check by mimetype rather than presence.
        blob_calls = [c for c in fake.send_calls if c["mimetype"] != "text/plain"]
        assert blob_calls == []

    def test_blob_end_without_pending_dropped_silently(self, client) -> None:
        tc, fake = client
        fake.chat_response = {"answers": ["text-after"]}
        with tc.websocket_connect("/api/ws/chat") as ws:
            ws.send_json({"type": "blob-end"})  # no pending — drop
            ws.send_json({"type": "text", "text": "hi"})
            msg = ws.receive_json()
        assert msg["type"] == "reply"

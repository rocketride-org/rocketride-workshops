"""Tests for `send_text` and `send_blob` helpers.

Both exercise:
- correct `client.send` dispatch (text/plain for text, binary mimetype for blobs)
- on_status callback fired only for `thinking` SSE
- tracer dump path
- exception propagation with tracer dump on error path

`send_blob_with_text` used to live here; it was removed when user messages
were locked to text-only OR attachment-only (no combined). The note at the
bottom of the file records the removal.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.libs.rocketride.chat import send_blob, send_text


class TestSendText:
    async def test_invokes_client_send_with_text_plain_mimetype(
        self, fake_client, tracer_log_dir
    ) -> None:
        result = await send_text("tk_webhook", "hello world")
        assert result == "blob-ok"
        # send_text now routes through the webhook source via client.send().
        assert len(fake_client.send_calls) == 1
        call = fake_client.send_calls[0]
        assert call["token"] == "tk_webhook"
        assert call["data"] == b"hello world"
        assert call["mimetype"] == "text/plain"
        assert call["objinfo"] == {"mimetype": "text/plain"}

    async def test_on_status_fires_only_for_thinking_events(
        self, fake_client, tracer_log_dir
    ) -> None:
        fake_client.send_sse_events = [
            ("thinking", {"message": "calling tool"}),
            ("apaevt_flow", {"message": "ignored payload"}),
            ("thinking", {"message": "tool done"}),
        ]
        statuses: list[str] = []

        async def cb(text: str) -> None:
            statuses.append(text)

        await send_text("tk_webhook", "go", on_status=cb)
        assert statuses == ["calling tool", "tool done"]

    async def test_returns_empty_string_when_no_answers(self, fake_client, tracer_log_dir) -> None:
        fake_client.send_response = {"answers": []}
        assert await send_text("tk_webhook", "go") == ""

    async def test_exception_during_send_dumps_tracer_and_propagates(
        self, fake_client, tracer_log_dir
    ) -> None:
        fake_client.send_side_effect = RuntimeError("engine boom")
        with pytest.raises(RuntimeError, match="engine boom"):
            await send_text("tk_webhook", "go")
        # Tracer file written even on error path.
        files = list(Path(tracer_log_dir).glob("*_tracer.log"))
        assert files, "tracer log expected on error path"

    async def test_on_status_callback_exception_swallowed(
        self, fake_client, tracer_log_dir
    ) -> None:
        fake_client.send_sse_events = [("thinking", {"message": "x"})]

        async def bad(_: str) -> None:
            raise RuntimeError("user cb failed")

        # Should not propagate even though the callback raises.
        result = await send_text("tk_webhook", "go", on_status=bad)
        assert result == "blob-ok"


class TestSendBlob:
    async def test_invokes_client_send_with_data_and_mimetype(
        self, fake_client, tracer_log_dir
    ) -> None:
        result = await send_blob("tk_webhook", b"\x00\x01\x02", "audio/webm")
        assert result == "blob-ok"
        assert len(fake_client.send_calls) == 1
        call = fake_client.send_calls[0]
        assert call["token"] == "tk_webhook"
        assert call["data"] == b"\x00\x01\x02"
        assert call["mimetype"] == "audio/webm"
        assert call["objinfo"] == {"mimetype": "audio/webm"}

    async def test_optional_name_recorded_in_objinfo(self, fake_client, tracer_log_dir) -> None:
        await send_blob("tk_webhook", b"abc", "image/png", name="cap.png")
        call = fake_client.send_calls[0]
        assert call["objinfo"] == {"mimetype": "image/png", "name": "cap.png"}

    async def test_exception_dumps_tracer_and_propagates(self, fake_client, tracer_log_dir) -> None:
        fake_client.send_side_effect = ConnectionError("dropped")
        with pytest.raises(ConnectionError):
            await send_blob("tk_webhook", b"x", "audio/webm")
        assert list(Path(tracer_log_dir).glob("*_tracer.log"))


# NOTE: `send_blob_with_text` has been removed — user messages are now
# strictly text-only OR attachment-only. The composer + WS handler enforce
# the mutex; previously combined-send tests have been deleted.

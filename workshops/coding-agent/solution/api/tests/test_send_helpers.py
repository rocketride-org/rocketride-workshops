"""Tests for `send_text`, `send_blob`, `send_blob_with_text` helpers.

All three exercise:
- correct SDK call dispatch (chat / send / send_files)
- on_status callback fired only for `thinking` SSE
- tracer dump path
- exception propagation with tracer dump on error path
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.libs.rocketride.chat import send_blob, send_blob_with_text, send_text


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


class TestSendBlobWithText:
    async def test_writes_two_temp_files_then_calls_send_files(
        self, fake_client, tracer_log_dir
    ) -> None:
        result = await send_blob_with_text(
            "tk_webhook", "describe this", b"\xde\xad\xbe\xef", "audio/webm"
        )
        assert result == "files-ok"
        assert len(fake_client.send_files_calls) == 1
        call = fake_client.send_files_calls[0]
        assert call["token"] == "tk_webhook"
        # Two file entries: caption + blob.
        assert len(call["files"]) == 2
        text_entry, blob_entry = call["files"]
        assert text_entry[2] == "text/plain"
        assert blob_entry[2] == "audio/webm"

    async def test_temp_files_cleaned_up_on_success(self, fake_client, tracer_log_dir) -> None:
        captured_paths: list[str] = []

        async def grab(files: list, token: str) -> list[dict]:
            for entry in files:
                captured_paths.append(entry[0])
            return [{"answers": ["ok"]}]

        fake_client.send_files = grab  # type: ignore[assignment]
        await send_blob_with_text("tk_webhook", "cap", b"x", "image/jpeg")
        for p in captured_paths:
            assert not Path(p).exists(), f"temp file {p} should be unlinked"

    async def test_temp_files_cleaned_up_on_send_failure(self, fake_client, tracer_log_dir) -> None:
        captured_paths: list[str] = []

        async def grab(files: list, token: str) -> list[dict]:
            for entry in files:
                captured_paths.append(entry[0])
            raise RuntimeError("send_files exploded")

        fake_client.send_files = grab  # type: ignore[assignment]
        with pytest.raises(RuntimeError, match="exploded"):
            await send_blob_with_text("tk_webhook", "cap", b"x", "image/jpeg")
        for p in captured_paths:
            assert not Path(p).exists()

    async def test_extracts_first_non_empty_answer_from_results_list(
        self, fake_client, tracer_log_dir
    ) -> None:
        fake_client.send_files_response = [
            {},  # caption result, no answer
            {"answers": ["agent reply"]},  # blob result with answer
        ]
        assert await send_blob_with_text("tk_webhook", "cap", b"x", "audio/webm") == "agent reply"

    async def test_returns_empty_when_no_results_have_answers(
        self, fake_client, tracer_log_dir
    ) -> None:
        fake_client.send_files_response = [{}, {"answers": []}]
        assert await send_blob_with_text("tk_webhook", "c", b"x", "audio/webm") == ""

    async def test_skips_non_dict_entries_in_results(self, fake_client, tracer_log_dir) -> None:
        fake_client.send_files_response = ["str-not-dict", {"answers": ["found"]}]  # type: ignore[list-item]
        assert await send_blob_with_text("tk_webhook", "c", b"x", "audio/webm") == "found"

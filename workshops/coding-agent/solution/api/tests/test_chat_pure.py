"""Pure-function tests for `app.libs.rocketride.chat` helpers."""

from __future__ import annotations

import pytest

from app.libs.rocketride import chat as chat_mod
from app.libs.rocketride.chat import (
    _capture_runtime_events,
    _extract_status,
    _first_answer,
    record_runtime_event,
)


class TestFirstAnswer:
    def test_empty_dict_returns_empty_string(self) -> None:
        assert _first_answer({}) == ""

    def test_empty_answers_list_returns_empty_string(self) -> None:
        assert _first_answer({"answers": []}) == ""

    def test_string_first_answer_returned_as_is(self) -> None:
        assert _first_answer({"answers": ["hello"]}) == "hello"

    def test_non_string_first_answer_coerced_via_str(self) -> None:
        assert _first_answer({"answers": [{"text": "x"}]}) == "{'text': 'x'}"

    def test_falsy_answers_field_treated_as_empty(self) -> None:
        assert _first_answer({"answers": None}) == ""


class TestExtractStatus:
    def test_thinking_with_string_message_returns_message(self) -> None:
        assert (
            _extract_status("thinking", {"message": "calling tool_shell"}) == "calling tool_shell"
        )

    def test_non_thinking_event_returns_empty(self) -> None:
        assert _extract_status("apaevt_flow", {"message": "ignored"}) == ""

    def test_non_dict_body_returns_empty(self) -> None:
        assert _extract_status("thinking", "scalar-body") == ""

    def test_missing_message_returns_empty(self) -> None:
        assert _extract_status("thinking", {"other": "data"}) == ""

    def test_non_string_message_returns_empty(self) -> None:
        assert _extract_status("thinking", {"message": 42}) == ""

    def test_empty_string_message_returns_empty(self) -> None:
        assert _extract_status("thinking", {"message": ""}) == ""


class TestCaptureRuntimeEvents:
    def test_record_outside_context_is_noop(self) -> None:
        # Ensure no leftover capture from earlier tests.
        chat_mod._active_capture = None
        record_runtime_event("apaevt_flow", 1, {"name": "X"})
        # No exception, no observable side effect.
        assert chat_mod._active_capture is None

    def test_buffer_collects_in_call_order(self) -> None:
        with _capture_runtime_events() as buf:
            record_runtime_event("evt1", 1, {"a": 1})
            record_runtime_event("evt2", 2, {"b": 2})
        assert [e["event"] for e in buf] == ["evt1", "evt2"]
        assert [e["seq"] for e in buf] == [1, 2]
        assert [e["body"] for e in buf] == [{"a": 1}, {"b": 2}]
        assert all("ts" in e for e in buf)

    def test_buffer_resets_after_context_exits(self) -> None:
        with _capture_runtime_events():
            record_runtime_event("evt", 1, {})
        # After exit, capture is None; further records are no-ops.
        assert chat_mod._active_capture is None
        record_runtime_event("evt", 2, {})

    def test_buffer_resets_after_exception_in_context(self) -> None:
        with pytest.raises(RuntimeError, match="boom"), _capture_runtime_events():
            record_runtime_event("evt", 1, {})
            raise RuntimeError("boom")
        assert chat_mod._active_capture is None

"""Pure-function tests for `app.libs.rocketride.chat` helpers."""

from __future__ import annotations

import pytest

from app.libs.rocketride import chat as chat_mod
from app.libs.rocketride.chat import (
    capture_events_for_turn,
    extract_thinking_message,
    first_answer_text,
    humanize_answer,
    record_runtime_event,
)


class TestFirstAnswer:
    def test_empty_dict_returns_empty_string(self) -> None:
        assert first_answer_text({}) == ""

    def test_empty_answers_list_returns_empty_string(self) -> None:
        assert first_answer_text({"answers": []}) == ""

    def test_string_first_answer_returned_as_is(self) -> None:
        assert first_answer_text({"answers": ["hello"]}) == "hello"

    def test_non_string_first_answer_coerced_via_str(self) -> None:
        assert first_answer_text({"answers": [{"text": "x"}]}) == "{'text': 'x'}"

    def test_falsy_answers_field_treated_as_empty(self) -> None:
        assert first_answer_text({"answers": None}) == ""

    def test_nested_result_answers_extracted(self) -> None:
        # `client.send_files` per-file entry shape: answers live one level
        # deeper, under `entry["result"]["answers"]`.
        entry = {
            "action": "complete",
            "filepath": "C:\\tmp\\foo.txt",
            "bytes_sent": 29,
            "result": {"answers": ["nested reply"], "name": "caption.txt"},
        }
        assert first_answer_text(entry) == "nested reply"

    def test_top_level_answers_preferred_over_nested(self) -> None:
        # If both shapes are present (defensive), prefer the top-level one.
        entry = {
            "answers": ["top"],
            "result": {"answers": ["nested"]},
        }
        assert first_answer_text(entry) == "top"

    def test_non_dict_input_returns_empty(self) -> None:
        # Defensive: accidental list / None / string inputs don't crash.
        assert first_answer_text(None) == ""  # type: ignore[arg-type]
        assert first_answer_text([{"answers": ["x"]}]) == ""  # type: ignore[arg-type]


class TestHumanizeAnswer:
    def test_plain_text_returned_unchanged(self) -> None:
        assert humanize_answer("hello there") == "hello there"

    def test_empty_string_returned_unchanged(self) -> None:
        assert humanize_answer("") == ""

    def test_non_string_returned_unchanged(self) -> None:
        # Defensive: should not raise on int / None / dict input.
        assert humanize_answer(None) is None  # type: ignore[arg-type]
        assert humanize_answer(42) == 42  # type: ignore[arg-type]

    def test_credit_balance_error_rewritten(self) -> None:
        raw = (
            "Deep agent invoke failed: Exception: Exception: Error code: 400 - "
            "{'type': 'error', 'error': {'type': 'invalid_request_error', "
            "'message': 'Your credit balance is too low to access the Anthropic API. "
            "Please go to Plans & Billing to upgrade or purchase credits.'}}"
        )
        rewritten = humanize_answer(raw)
        assert "credit balance" not in rewritten.lower() or "out of credits" in rewritten
        assert "out of credits" in rewritten
        assert "console.anthropic.com" in rewritten
        # Stack trace gone.
        assert "Deep agent invoke failed" not in rewritten

    def test_credit_balance_substring_match_anywhere(self) -> None:
        # The needle should match even when wrapped in extra context.
        assert (
            humanize_answer(
                "prefix Your credit balance is too low to access the Anthropic API suffix"
            )
            != "prefix Your credit balance is too low to access the Anthropic API suffix"
        )


class TestExtractStatus:
    def test_thinking_with_string_message_returns_message(self) -> None:
        assert (
            extract_thinking_message("thinking", {"message": "calling tool_shell"})
            == "calling tool_shell"
        )

    def test_non_thinking_event_returns_empty(self) -> None:
        assert extract_thinking_message("apaevt_flow", {"message": "ignored"}) == ""

    def test_non_dict_body_returns_empty(self) -> None:
        assert extract_thinking_message("thinking", "scalar-body") == ""

    def test_missing_message_returns_empty(self) -> None:
        assert extract_thinking_message("thinking", {"other": "data"}) == ""

    def test_non_string_message_returns_empty(self) -> None:
        assert extract_thinking_message("thinking", {"message": 42}) == ""

    def test_empty_string_message_returns_empty(self) -> None:
        assert extract_thinking_message("thinking", {"message": ""}) == ""


class TestCaptureRuntimeEvents:
    def test_record_outside_context_is_noop(self) -> None:
        # Ensure no leftover capture from earlier tests.
        chat_mod.current_turn_event_buffer = None
        record_runtime_event("apaevt_flow", 1, {"name": "X"})
        # No exception, no observable side effect.
        assert chat_mod.current_turn_event_buffer is None

    def test_buffer_collects_in_call_order(self) -> None:
        with capture_events_for_turn() as buf:
            record_runtime_event("evt1", 1, {"a": 1})
            record_runtime_event("evt2", 2, {"b": 2})
        assert [e["event"] for e in buf] == ["evt1", "evt2"]
        assert [e["seq"] for e in buf] == [1, 2]
        assert [e["body"] for e in buf] == [{"a": 1}, {"b": 2}]
        assert all("ts" in e for e in buf)

    def test_buffer_resets_after_context_exits(self) -> None:
        with capture_events_for_turn():
            record_runtime_event("evt", 1, {})
        # After exit, capture is None; further records are no-ops.
        assert chat_mod.current_turn_event_buffer is None
        record_runtime_event("evt", 2, {})

    def test_buffer_resets_after_exception_in_context(self) -> None:
        with pytest.raises(RuntimeError, match="boom"), capture_events_for_turn():
            record_runtime_event("evt", 1, {})
            raise RuntimeError("boom")
        assert chat_mod.current_turn_event_buffer is None

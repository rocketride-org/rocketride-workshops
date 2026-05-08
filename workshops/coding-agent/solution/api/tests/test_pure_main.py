"""Pure-function tests for `app.main` formatters and the disconnect classifier."""

from __future__ import annotations

import pytest

from app.main import (
    LOG_PAYLOAD_MAX_CHARS,
    format_node_error_event,
    format_node_event,
    format_sse_event,
    is_engine_disconnect,
    truncate,
)


class TestTrunc:
    def test_none_returns_empty_string(self) -> None:
        assert truncate(None) == ""

    def test_short_string_passthrough(self) -> None:
        assert truncate("hello") == "hello"

    def test_long_string_truncated_with_ellipsis(self) -> None:
        long = "x" * (LOG_PAYLOAD_MAX_CHARS + 50)
        out = truncate(long)
        assert len(out) == LOG_PAYLOAD_MAX_CHARS
        assert out.endswith("…")

    def test_custom_n_overrides_default(self) -> None:
        assert truncate("abcdefgh", n=4) == "abc…"

    def test_non_string_value_coerced_via_str(self) -> None:
        assert truncate(42) == "42"


class TestFmtNode:
    def test_extracts_name_and_status_from_dict(self) -> None:
        out = format_node_event(
            7, "apaevt_node_started", {"name": "Engineer 1", "status": "running"}
        )
        assert "seq=7" in out
        assert "name=Engineer 1" in out
        assert "status=running" in out

    def test_non_dict_body_yields_none_fields(self) -> None:
        out = format_node_event(0, "evt", "not-a-dict")
        assert "name=None" in out
        assert "status=None" in out


class TestFmtNodeError:
    def test_uses_error_field_first(self) -> None:
        out = format_node_error_event(
            1, "apaevt_node_error", {"name": "X", "error": "boom", "message": "ignored"}
        )
        assert "name=X" in out
        assert "boom" in out

    def test_falls_back_to_message_field(self) -> None:
        out = format_node_error_event(1, "apaevt_node_error", {"name": "X", "message": "fallback"})
        assert "fallback" in out

    def test_truncates_long_error(self) -> None:
        out = format_node_error_event(1, "apaevt_node_error", {"name": "X", "error": "y" * 500})
        # format_node_error_event truncates error at 160 chars
        assert "…" in out

    def test_non_dict_body_yields_none_error(self) -> None:
        out = format_node_error_event(2, "apaevt_node_error", "scalar")
        assert "name=None" in out
        assert "error=" in out


class TestFmtSse:
    def test_dict_body_with_event_type_and_message(self) -> None:
        out = format_sse_event(
            3, "apaevt_sse", {"event_type": "thinking", "message": "calling tool"}
        )
        assert "seq=3" in out
        assert "thinking" in out
        assert "calling tool" in out

    def test_dict_body_falls_back_to_type_and_text(self) -> None:
        out = format_sse_event(3, "apaevt_sse", {"type": "status", "text": "warming up"})
        assert "status" in out
        assert "warming up" in out

    def test_scalar_body_serialized_via_truncate(self) -> None:
        out = format_sse_event(4, "apaevt_sse", "raw-string")
        assert "seq=4" in out
        assert "raw-string" in out


class TestIsDisconnectError:
    @pytest.mark.parametrize(
        "exc",
        [
            ConnectionError("bad"),
            OSError(32, "Broken pipe"),
            TimeoutError("late"),
        ],
    )
    def test_transport_errors_classified_as_disconnect(self, exc: BaseException) -> None:
        assert is_engine_disconnect(exc) is True

    @pytest.mark.parametrize(
        "msg",
        [
            "Server is not connected",
            "Could not send request",
            "Pipeline is not currently running",
            "PIPELINE IS NOT CURRENTLY RUNNING",  # case-insensitive substring
        ],
    )
    def test_runtime_error_with_known_substring_is_disconnect(self, msg: str) -> None:
        assert is_engine_disconnect(RuntimeError(msg)) is True

    def test_runtime_error_with_unknown_message_not_disconnect(self) -> None:
        assert is_engine_disconnect(RuntimeError("some other failure")) is False

    def test_value_error_not_disconnect(self) -> None:
        assert is_engine_disconnect(ValueError("bad payload")) is False

"""Tests for `start_coding_agent` — two-source pipeline init."""

from __future__ import annotations

from app.libs.rocketride.chat import (
    CHAT_SOURCE_ID,
    WEBHOOK_SOURCE_ID,
    start_coding_agent,
)


async def test_starts_two_pipelines_one_per_source(fake_client) -> None:
    tokens = await start_coding_agent()
    assert tokens == {"chat": "tk_chat_1", "webhook": "tk_webhook_1"}

    sources = [c["source"] for c in fake_client.use_calls]
    assert sources == [CHAT_SOURCE_ID, WEBHOOK_SOURCE_ID]


async def test_uses_full_trace_level_and_zero_ttl(fake_client) -> None:
    await start_coding_agent()
    for call in fake_client.use_calls:
        assert call["pipelineTraceLevel"] == "full"
        assert call["ttl"] == 0


async def test_set_events_called_per_token(fake_client) -> None:
    await start_coding_agent()
    tokens = [t for t, _ in fake_client.set_events_calls]
    # Two calls — one per started pipeline.
    assert tokens == ["tk_chat_1", "tk_webhook_1"]
    # Same event-type list for both.
    types_lists = [t for _, t in fake_client.set_events_calls]
    assert types_lists[0] == types_lists[1]
    assert "flow" in types_lists[0]
    assert "sse" in types_lists[0]


async def test_set_events_failure_is_non_fatal(fake_client) -> None:
    fake_client.set_events_side_effect = RuntimeError("subscription denied")
    # Should not propagate; pipelines remain usable.
    tokens = await start_coding_agent()
    assert tokens == {"chat": "tk_chat_1", "webhook": "tk_webhook_1"}

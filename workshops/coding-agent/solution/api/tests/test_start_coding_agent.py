"""Tests for `start_coding_agent` — single-source webhook pipeline."""

from __future__ import annotations

from app.libs.rocketride.chat import (
    WEBHOOK_SOURCE_ID,
    start_coding_agent,
)


async def test_starts_single_pipeline_against_webhook_source(fake_client) -> None:
    token = await start_coding_agent()
    assert token == "tk_webhook_1"

    sources = [c["source"] for c in fake_client.use_calls]
    assert sources == [WEBHOOK_SOURCE_ID]


async def test_uses_full_trace_level_and_zero_ttl(fake_client) -> None:
    await start_coding_agent()
    assert len(fake_client.use_calls) == 1
    call = fake_client.use_calls[0]
    assert call["pipelineTraceLevel"] == "full"
    assert call["ttl"] == 0


async def test_set_events_called_with_full_event_list(fake_client) -> None:
    await start_coding_agent()
    assert len(fake_client.set_events_calls) == 1
    token, types_list = fake_client.set_events_calls[0]
    assert token == "tk_webhook_1"
    assert "flow" in types_list
    assert "sse" in types_list


async def test_set_events_failure_is_non_fatal(fake_client) -> None:
    fake_client.set_events_side_effect = RuntimeError("subscription denied")
    # Should not propagate; pipeline remains usable.
    token = await start_coding_agent()
    assert token == "tk_webhook_1"

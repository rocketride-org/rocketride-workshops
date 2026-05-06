"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, cast

from app.libs.rocketride.client import get_client

logger = logging.getLogger("coding-agent")

PIPELINE_PATH = Path(__file__).resolve().parents[2] / "pipelines" / "coding-agent.pipe"

RUNTIME_EVENT_TYPES = ["task", "summary", "sse"]

StatusCallback = Callable[[str], Awaitable[None]]


async def start_coding_agent() -> str:
    client = await get_client()
    result = cast(
        dict[str, Any],
        await client.use(filepath=str(PIPELINE_PATH), pipelineTraceLevel="none"),
    )
    token = cast(str, result["token"])
    try:
        await client.set_events(token, RUNTIME_EVENT_TYPES)
    except Exception:
        logger.exception("set_events failed; continuing without runtime observability")
    return token


async def send_text(
    token: str,
    text: str,
    on_status: StatusCallback | None = None,
) -> str:
    return await _send(token, text.encode(), "text/plain", on_status)


async def send_audio(
    token: str,
    data: bytes,
    mimetype: str = "audio/webm;codecs=opus",
    on_status: StatusCallback | None = None,
) -> str:
    return await _send(token, data, mimetype, on_status)


async def _send(
    token: str,
    data: bytes,
    mimetype: str,
    on_status: StatusCallback | None,
) -> str:
    client = await get_client()

    async def _sse(event_type: str, body: dict[str, Any]) -> None:
        if on_status is None:
            return
        message = _extract_status(event_type, body)
        if not message:
            return
        try:
            await on_status(message)
        except Exception:
            logger.exception("on_status raised; dropping event")

    pipe = await client.pipe(token, mime_type=mimetype, on_sse=_sse)
    async with pipe:
        await pipe.write(data)
        result = cast(dict[str, Any], await pipe.close())
    return _first_answer(result)


def _extract_status(event_type: str, body: Any) -> str:
    """Pull a human-readable status line out of a CrewAI 'thinking' SSE.

    The engine's `crewai_listener._dispatch` sends every CrewAI bus event
    as `sendSSE('thinking', message=label, **event_fields)`. Labels read
    naturally ("Crew started", "Agent thinking...", "Calling tool_shell...").
    Anything else (including provider-specific SSE shapes we don't model)
    is ignored so the UI never shows raw payloads.
    """
    if event_type != "thinking" or not isinstance(body, dict):
        return ""
    message = body.get("message")
    return message if isinstance(message, str) and message else ""


def _first_answer(result: dict[str, Any]) -> str:
    answers = result.get("answers") or []
    if not answers:
        return ""
    first = answers[0]
    if isinstance(first, str):
        return first
    return str(first)

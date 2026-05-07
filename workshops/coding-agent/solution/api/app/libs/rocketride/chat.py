"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, cast

from app.libs.rocketride.client import get_client

logger = logging.getLogger("coding-agent")

PIPELINES_DIR = Path(__file__).resolve().parents[2] / "pipelines"
PIPELINE_PATH = PIPELINES_DIR / "coding-agent.pipe"

RUNTIME_EVENT_TYPES = ["task", "summary", "sse"]

StatusCallback = Callable[[str], Awaitable[None]]


async def start_coding_agent() -> str:
    client = await get_client()
    # ttl=0 disables the engine's idle-pipeline GC so the cached token stays
    # valid across turns. Without this, long fan-outs (35-node deepagent) push
    # past the server-default idle window and the next pipe.open() raises
    # "Your pipeline is not currently running."
    result = cast(
        dict[str, Any],
        await client.use(
            filepath=str(PIPELINE_PATH),
            pipelineTraceLevel="none",
            ttl=0,
        ),
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
    """Pull a human-readable status line out of a 'thinking' SSE.

    Deep Agent emits `sendSSE('thinking', message=label, ...)` from its
    LangChain callback handler ("LLM call started", "Calling tool_shell...",
    "Tool complete"). Anything else is ignored so the UI never shows raw
    payloads.
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

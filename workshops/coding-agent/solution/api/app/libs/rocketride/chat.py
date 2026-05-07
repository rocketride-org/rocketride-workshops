"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from rocketride.schema import Question

from app.libs.rocketride.client import get_client

logger = logging.getLogger("coding-agent")

PIPELINES_DIR = Path(__file__).resolve().parents[2] / "pipelines"
PIPELINE_PATH = PIPELINES_DIR / "coding-agent.pipe"
LOG_DIR = Path(__file__).resolve().parents[4] / "logs"

RUNTIME_EVENT_TYPES = ["task", "summary", "sse"]
TRACE_LEVEL = "full"

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
            pipelineTraceLevel=TRACE_LEVEL,
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
    """Send a text turn through the chat source. Returns the first answer.

    The pipe's source is `provider: "chat"`, so we use the SDK's
    `client.chat()` (which wraps a Question into a `chat://` pipe under the
    hood) instead of `client.pipe(...).write()`. The chat source emits the
    `questions` lane directly — no audio_transcribe / question node needed.
    """
    client = await get_client()
    sse_events: list[dict[str, Any]] = []

    async def _sse(event_type: str, body: dict[str, Any]) -> None:
        sse_events.append({"ts": datetime.now().isoformat(), "type": event_type, "body": body})
        if on_status is None:
            return
        message = _extract_status(event_type, body)
        if not message:
            return
        try:
            await on_status(message)
        except Exception:
            logger.exception("on_status raised; dropping event")

    q = Question()  # type: ignore[call-arg]  # pydantic Field defaults; mypy can't infer
    q.addQuestion(text)
    started = datetime.now()
    try:
        result = cast(
            dict[str, Any],
            await client.chat(token=token, question=q, on_sse=_sse),
        )
        _dump_tracer(started, text, sse_events, result, error=None)
    except Exception as exc:
        _dump_tracer(started, text, sse_events, None, error=exc)
        raise
    return _first_answer(result)


def _dump_tracer(
    started: datetime,
    prompt: str,
    sse_events: list[dict[str, Any]],
    result: dict[str, Any] | None,
    error: BaseException | None,
) -> None:
    """Append one run's raw tracer payload to ``logs/{YYYY-MM-DD}_tracer.log``.

    Writes the prompt, every SSE event captured during the chat call, the
    full ``result`` dict (which carries ``_trace`` when ``pipelineTraceLevel``
    is set), and any terminating exception. Nothing is filtered or
    summarised — the goal is to keep raw material for later review.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    ended = datetime.now()
    path = LOG_DIR / f"{started.strftime('%Y-%m-%d')}_tracer.log"
    payload = {
        "run_started": started.isoformat(),
        "run_ended": ended.isoformat(),
        "prompt": prompt,
        "sse_events": sse_events,
        "result": result,
        "error": repr(error) if error is not None else None,
    }
    try:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(f"\n===== run start {started.isoformat()} =====\n")
            json.dump(payload, fh, default=str, indent=2)
            fh.write(f"\n===== run end {ended.isoformat()} =====\n")
    except Exception:
        logger.exception("tracer dump failed for %s", path)


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

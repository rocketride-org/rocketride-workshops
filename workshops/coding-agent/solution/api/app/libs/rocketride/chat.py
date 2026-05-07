"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
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

    q = Question()  # type: ignore[call-arg]  # pydantic Field defaults; mypy can't infer
    q.addQuestion(text)
    with _per_run_tracer() as tracer:
        logger.info("chat turn start: %s", _trunc(text))
        result = cast(
            dict[str, Any],
            await client.chat(token=token, question=q, on_sse=_sse),
        )
        trace = result.get("_trace") if isinstance(result, dict) else None
        if trace is not None:
            tracer.write("---- _trace ----\n")
            tracer.write(json.dumps(trace, default=str, indent=2))
            tracer.write("\n")
        else:
            tracer.write("---- _trace missing from result ----\n")
        logger.info("chat turn end")
    return _first_answer(result)


@contextmanager
def _per_run_tracer() -> Iterator[Any]:
    """Attach a per-run FileHandler to the root logger and yield its stream.

    File: ``logs/{YYYY-MM-DD}_tracer.log`` at the solution workspace root.
    Reuses the root logger's secret-scrub filter so secrets never land on
    disk. Each run is bracketed with start/end markers so multiple runs in
    the same day stay separable.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    started = datetime.now()
    path = LOG_DIR / f"{started.strftime('%Y-%m-%d')}_tracer.log"
    handler = logging.FileHandler(path, mode="a", encoding="utf-8")
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    for existing_filter in root.filters:
        handler.addFilter(existing_filter)
    # rocketride-runtime sets propagate=False, so attach directly to capture
    # engine-side logs in the same per-run file.
    runtime = logging.getLogger("rocketride-runtime")
    root.addHandler(handler)
    runtime.addHandler(handler)
    stream = cast(Any, handler.stream)
    stream.write(f"\n===== run start {started.isoformat()} =====\n")
    handler.flush()
    try:
        yield stream
    finally:
        ended = datetime.now()
        try:
            stream.write(f"===== run end {ended.isoformat()} =====\n")
            handler.flush()
        finally:
            runtime.removeHandler(handler)
            root.removeHandler(handler)
            handler.close()


def _trunc(value: str, n: int = 200) -> str:
    return value if len(value) <= n else value[: n - 1] + "…"


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

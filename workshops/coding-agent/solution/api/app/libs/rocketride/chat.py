"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

import contextlib
import json
import logging
import os
import tempfile
import uuid
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, cast

from rocketride.schema import Question

from app.libs.rocketride.client import get_client

logger = logging.getLogger("coding-agent")

PIPELINES_DIR = Path(__file__).resolve().parents[2] / "pipelines"
# Swap pipelines for A/B speed comparisons via env, e.g.
# `CODING_PIPELINE=coding-agent-new.pipe` selects the single-Cody-Rider
# baseline; default is the Deep Agent fan-out pipeline.
PIPELINE_PATH = PIPELINES_DIR / os.environ.get("CODING_PIPELINE", "coding-agent.pipe")
LOG_DIR = Path(__file__).resolve().parents[4] / "logs"

# Subscribe to the full observability fan: task lifecycle, periodic status,
# per-component flow traces (input/output/error per node — only delivered when
# the pipeline was started with pipelineTraceLevel != "none"), engine output
# lines, and node→UI SSE. FLOW is what carries the exact per-node payloads
# Studio renders; without it the tracer file is just lifecycle confetti.
RUNTIME_EVENT_TYPES = ["task", "summary", "flow", "output", "sse"]
TRACE_LEVEL = "full"

StatusCallback = Callable[[str], Awaitable[None]]

# Per-turn buffer for global runtime events. Set by `_capture_runtime_events`
# while a chat turn is in flight, then drained into the tracer file. Module-
# level (not contextvar) because the SDK dispatches global events from its WS
# task, which doesn't share context with the request task. Single-user
# workshop only — main.py's send_lock guarantees one turn at a time.
_active_capture: list[dict[str, Any]] | None = None


CodingTokens = dict[str, str]

# IDs of the source nodes inside `coding-agent.pipe`. The pipe declares both
# sources without a root `"source"` field, so `client.use()` requires us to
# pick one explicitly per instance. We start two pipeline instances — one
# bound to the chat source for text turns, one bound to the webhook source
# for audio/image blobs — and route at the API layer based on input modality.
CHAT_SOURCE_ID = "chat_1"
WEBHOOK_SOURCE_ID = "webhook_1"


async def start_coding_agent() -> CodingTokens:
    """Start the coding-agent pipeline twice — once per source node — and
    return both tokens.

    Returns a mapping `{"chat": <token>, "webhook": <token>}`. Callers use
    the chat token with `client.chat()` (text turns) and the webhook token
    with `client.send()` (audio/image blobs).
    """
    client = await get_client()
    tokens: CodingTokens = {}
    # ttl=0 disables the engine's idle-pipeline GC so the cached tokens stay
    # valid across turns. Without this, long fan-outs (35-node deepagent) push
    # past the server-default idle window and the next pipe.open() raises
    # "Your pipeline is not currently running."
    for kind, source_id in (("chat", CHAT_SOURCE_ID), ("webhook", WEBHOOK_SOURCE_ID)):
        logger.info("loading pipeline: %s (source=%s)", PIPELINE_PATH.name, source_id)
        result = cast(
            dict[str, Any],
            await client.use(
                filepath=str(PIPELINE_PATH),
                source=source_id,
                pipelineTraceLevel=TRACE_LEVEL,
                ttl=0,
            ),
        )
        token = cast(str, result["token"])
        tokens[kind] = token
        try:
            await client.set_events(token, RUNTIME_EVENT_TYPES)
        except Exception:
            logger.exception(
                "set_events failed for source=%s; continuing without runtime observability",
                source_id,
            )
    return tokens


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
    with _capture_runtime_events() as runtime_events:
        try:
            result = cast(
                dict[str, Any],
                await client.chat(token=token, question=q, on_sse=_sse),
            )
            _dump_tracer(started, text, sse_events, runtime_events, result, error=None)
        except Exception as exc:
            _dump_tracer(started, text, sse_events, runtime_events, None, error=exc)
            raise
    return _first_answer(result)


async def send_blob(
    token: str,
    data: bytes,
    mimetype: str,
    on_status: StatusCallback | None = None,
    name: str | None = None,
) -> str:
    """Send a binary blob (audio/image) through the webhook source.

    The pipe's `webhook_1` source emits the `audio` and `image` lanes. The
    pipeline routes audio through `audio_transcribe_1` and images through
    `ocr_1`, both feeding `question_1` -> `agent_deepagent_1`, so the same
    agent answers regardless of input modality. We use `client.send()`
    (single-shot bytes) rather than `client.pipe()` because MediaRecorder
    in the UI hands us a finished blob, not a live stream.

    Returns the first answer from `response_answers_1`, same shape as
    `send_text`.
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

    objinfo: dict[str, Any] = {"mimetype": mimetype}
    if name:
        objinfo["name"] = name

    tracer_label = f"<blob {len(data)} bytes mimetype={mimetype}{f' name={name}' if name else ''}>"
    started = datetime.now()
    with _capture_runtime_events() as runtime_events:
        try:
            result = cast(
                dict[str, Any],
                await client.send(
                    token=token,
                    data=data,
                    mimetype=mimetype,
                    objinfo=objinfo,
                    on_sse=_sse,
                ),
            )
            _dump_tracer(started, tracer_label, sse_events, runtime_events, result, error=None)
        except Exception as exc:
            _dump_tracer(started, tracer_label, sse_events, runtime_events, None, error=exc)
            raise
    return _first_answer(result)


async def send_blob_with_text(
    token: str,
    text: str,
    data: bytes,
    mimetype: str,
    on_status: StatusCallback | None = None,
    name: str | None = None,
) -> str:
    """Send a binary blob plus accompanying typed text through the webhook
    source as a single task.

    Used when the user submits a chat message that includes both a typed
    caption and an attachment (audio recording or image). We use
    `client.send_files()` which uploads multiple files in parallel against
    one task token: the text file routes to `webhook.text`, the audio/image
    file routes to `webhook.audio` / `webhook.image`. Pipeline merges both
    text streams at `question_1` and the agent sees the user's caption
    alongside the transcribed/OCR'd content.

    Both payloads are written to throwaway temp files because
    `client.send_files()` is filepath-based.
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

    tracer_label = (
        f"<blob+text blob_size={len(data)} mimetype={mimetype}"
        f"{f' name={name}' if name else ''} text_len={len(text)}>"
    )
    started = datetime.now()
    tmp_dir = Path(tempfile.gettempdir())
    suffix = mimetype.split("/")[-1].split(";")[0] or "bin"
    blob_path = tmp_dir / f"rr-blob-{uuid.uuid4().hex}.{suffix}"
    text_path = tmp_dir / f"rr-text-{uuid.uuid4().hex}.txt"
    blob_path.write_bytes(data)
    text_path.write_text(text, encoding="utf-8")
    try:
        # set_events already subscribed to SSE for this token; client.send_files
        # doesn't take on_sse, so per-node status updates flow via the global
        # event handler (main.py:_on_runtime_event) — this `_sse` capture only
        # records what comes back from the upload calls themselves.
        files: list[Any] = [
            (str(text_path), {"name": "caption.txt", "mimetype": "text/plain"}, "text/plain"),
            (
                str(blob_path),
                {"name": name or blob_path.name, "mimetype": mimetype},
                mimetype,
            ),
        ]
        with _capture_runtime_events() as runtime_events:
            try:
                results = cast(
                    list[dict[str, Any]],
                    await client.send_files(files, token),
                )
                _dump_tracer(started, tracer_label, sse_events, runtime_events, results, error=None)
            except Exception as exc:
                _dump_tracer(started, tracer_label, sse_events, runtime_events, None, error=exc)
                raise
    finally:
        for path in (blob_path, text_path):
            with contextlib.suppress(Exception):
                path.unlink()

    # send_files returns a list — first non-empty answer wins. The pipeline
    # produces one agent response per task token regardless of how many files
    # were uploaded, but the answer surfaces under whichever file's result
    # the SDK happens to attach it to.
    for entry in results:
        answer = _first_answer(entry) if isinstance(entry, dict) else ""
        if answer:
            return answer
    return ""


@contextmanager
def _capture_runtime_events() -> Iterator[list[dict[str, Any]]]:
    """Open a per-turn buffer for global runtime events.

    main.py's `_on_runtime_event` tees every non-noise event into the
    active buffer via `record_runtime_event`. Buffer is reset on exit so
    later turns don't inherit stale events.
    """
    global _active_capture
    buffer: list[dict[str, Any]] = []
    _active_capture = buffer
    try:
        yield buffer
    finally:
        _active_capture = None


def record_runtime_event(event_type: str, seq: Any, body: Any) -> None:
    """Append a global runtime event to the active per-turn capture buffer.

    No-op when no turn is in flight. Called from main.py's runtime event
    handler so the tracer dump can include per-node invokes (the same
    detail Studio renders).
    """
    if _active_capture is None:
        return
    _active_capture.append(
        {
            "ts": datetime.now().isoformat(),
            "event": event_type,
            "seq": seq,
            "body": body,
        }
    )


def _dump_tracer(
    started: datetime,
    prompt: str,
    sse_events: list[dict[str, Any]],
    runtime_events: list[dict[str, Any]],
    result: dict[str, Any] | list[Any] | None,
    error: BaseException | None,
) -> None:
    """Append one run's raw tracer payload to ``logs/{YYYY-MM-DD}_tracer.log``.

    Writes the prompt, every SSE event captured during the chat call, every
    global runtime event captured during the chat call (the per-node invoke
    stream Studio renders), the full ``result`` dict, and any terminating
    exception. Nothing is filtered or summarised — the goal is to keep raw
    material for later review.
    """
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    ended = datetime.now()
    path = LOG_DIR / f"{started.strftime('%Y-%m-%d')}_tracer.log"
    payload = {
        "run_started": started.isoformat(),
        "run_ended": ended.isoformat(),
        "prompt": prompt,
        "sse_events": sse_events,
        "runtime_events": runtime_events,
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

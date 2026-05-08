"""Pipeline lifecycle and send helpers for the coding-agent pipeline.

A few RocketRide terms used throughout this file:

- **Source** — a door into the pipeline. The pipe declares two: `chat_1`
  for typed messages, `webhook_1` for uploaded blobs.
- **Token** — a boarding pass returned by `client.use(...)`. Every send
  call hands the token back so the engine knows which pipeline run you
  mean. Tokens go stale once the pipeline is idle longer than its TTL.
- **Lane** — a named conveyor belt between nodes. `chat_1` emits on the
  `questions` lane; `webhook_1` emits on `audio`, `image`, and `text`.
  Same cargo, different belt = different next stop downstream.

Why we start two pipelines: the pipe declares two source nodes, but the
SDK requires picking one per `client.use()` call. We start two instances
— one bound to each source — and route at the API layer based on
whether the user typed text or sent a blob.
"""

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
# Override `CODING_PIPELINE` to A/B-test alternate pipe files without code edits.
PIPELINE_PATH = PIPELINES_DIR / os.environ.get("CODING_PIPELINE", "coding-agent.pipe")
LOG_DIR = Path(__file__).resolve().parents[4] / "logs"

# The events the tracer file needs: task lifecycle, summary, per-node flow
# (only emitted when pipelineTraceLevel != "none"), engine stdout, and
# node→UI SSE. Without "flow" the tracer is just lifecycle confetti.
RUNTIME_EVENT_TYPES = ["task", "summary", "flow", "output", "sse"]
TRACE_LEVEL = "full"

StatusCallback = Callable[[str], Awaitable[None]]

# Per-turn scratch space for runtime events. `capture_events_for_turn`
# opens it; `record_runtime_event` (called from main.py) appends to it
# while the turn runs. Module-level (not a contextvar) because the SDK
# delivers events from a different async task — the request task can't
# share a context with it. Single-user workshop: one turn at a time, so
# a single shared buffer is safe.
current_turn_event_buffer: list[dict[str, Any]] | None = None


CodingTokens = dict[str, str]

# IDs of the source nodes inside `coding-agent.pipe`. Must match the JSON.
CHAT_SOURCE_ID = "chat_1"
WEBHOOK_SOURCE_ID = "webhook_1"


# We start the pipe twice — once per source node — so text and blob turns
# route to different `client.use()` instances. Both instances share the
# same downstream graph (deepagent → response_answers).
async def start_coding_agent() -> CodingTokens:
    """Start both pipelines (chat + webhook source) and return their tokens.

    Returns a mapping `{"chat": <token>, "webhook": <token>}`. The chat
    token is for `client.chat()` calls; the webhook token is for
    `client.send()` / `client.send_files()` calls.
    """
    client = await get_client()
    tokens: CodingTokens = {}
    # ttl=0 disables the engine's idle-pipeline GC. Long deepagent fan-outs
    # otherwise push past the default idle window and the next call hits
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


def make_sse_capture(
    sse_events: list[dict[str, Any]],
    on_status: StatusCallback | None,
) -> Callable[[str, dict[str, Any]], Awaitable[None]]:
    """Build the on_sse callback shared by every send_* helper.

    The callback records the raw SSE event for the tracer file and, if
    the caller asked for status updates, forwards 'thinking' messages
    (the LangChain step labels Deep Agent emits) to `on_status`.
    """

    async def record_sse_event(event_type: str, body: dict[str, Any]) -> None:
        sse_events.append({"ts": datetime.now().isoformat(), "type": event_type, "body": body})
        if on_status is None:
            return
        message = extract_thinking_message(event_type, body)
        if not message:
            return
        try:
            await on_status(message)
        except Exception:
            logger.exception("on_status raised; dropping event")

    return record_sse_event


async def send_text(
    token: str,
    text: str,
    on_status: StatusCallback | None = None,
) -> str:
    """Send a text turn through the chat source. Returns the agent's answer.

    `client.chat()` wraps a Question into a `chat://` pipe under the hood,
    landing the text directly on the `questions` lane — no transcribe or
    OCR step needed since the user already typed words.
    """
    client = await get_client()
    sse_events: list[dict[str, Any]] = []
    record_sse_event = make_sse_capture(sse_events, on_status)

    question = Question()  # type: ignore[call-arg]  # pydantic Field defaults; mypy can't infer
    question.addQuestion(text)
    started = datetime.now()
    with capture_events_for_turn() as runtime_events:
        try:
            result = cast(
                dict[str, Any],
                await client.chat(token=token, question=question, on_sse=record_sse_event),
            )
            write_turn_trace(started, text, sse_events, runtime_events, result, error=None)
        except Exception as exc:
            write_turn_trace(started, text, sse_events, runtime_events, None, error=exc)
            raise
    return first_answer_text(result)


async def send_blob(
    token: str,
    data: bytes,
    mimetype: str,
    on_status: StatusCallback | None = None,
    name: str | None = None,
) -> str:
    """Send a binary blob (audio or image) through the webhook source.

    `client.send()` is the single-shot path: MediaRecorder hands us a
    finished blob, not a live stream, so streaming would only add
    complexity. Audio routes through `audio_transcribe_1`, images through
    `ocr_1`, and both meet at `question_1` → `agent_deepagent_1` →
    `response_answers_1`. Same final answer shape as `send_text`.
    """
    client = await get_client()
    sse_events: list[dict[str, Any]] = []
    record_sse_event = make_sse_capture(sse_events, on_status)

    objinfo: dict[str, Any] = {"mimetype": mimetype}
    if name:
        objinfo["name"] = name

    tracer_label = f"<blob {len(data)} bytes mimetype={mimetype}{f' name={name}' if name else ''}>"
    started = datetime.now()
    with capture_events_for_turn() as runtime_events:
        try:
            result = cast(
                dict[str, Any],
                await client.send(
                    token=token,
                    data=data,
                    mimetype=mimetype,
                    objinfo=objinfo,
                    on_sse=record_sse_event,
                ),
            )
            write_turn_trace(started, tracer_label, sse_events, runtime_events, result, error=None)
        except Exception as exc:
            write_turn_trace(started, tracer_label, sse_events, runtime_events, None, error=exc)
            raise
    return first_answer_text(result)


async def send_blob_with_text(
    token: str,
    text: str,
    data: bytes,
    mimetype: str,
    on_status: StatusCallback | None = None,
    name: str | None = None,
) -> str:
    """Send a blob plus a typed caption through the webhook as one task.

    `client.send_files()` uploads multiple files in parallel against a
    single token: the caption file lands on the `text` lane, the blob on
    `audio`/`image`. Both text streams meet at `question_1`, so the
    agent sees the user's caption alongside the transcribed/OCR'd
    content.

    `send_files` is filepath-based, so we write throwaway temp files for
    both payloads. They're unlinked on the way out, win or lose.
    """
    client = await get_client()
    # `client.send_files` doesn't accept an on_sse callback, so per-node
    # status updates flow through main.py's global runtime-event handler
    # instead. We still keep `sse_events` for tracer-file symmetry — it
    # ends up empty for this code path but the tracer schema stays uniform.
    sse_events: list[dict[str, Any]] = []

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
        files: list[Any] = [
            (str(text_path), {"name": "caption.txt", "mimetype": "text/plain"}, "text/plain"),
            (
                str(blob_path),
                {"name": name or blob_path.name, "mimetype": mimetype},
                mimetype,
            ),
        ]
        with capture_events_for_turn() as runtime_events:
            try:
                results = cast(
                    list[dict[str, Any]],
                    await client.send_files(files, token),
                )
                write_turn_trace(
                    started, tracer_label, sse_events, runtime_events, results, error=None
                )
            except Exception as exc:
                write_turn_trace(started, tracer_label, sse_events, runtime_events, None, error=exc)
                raise
    finally:
        for path in (blob_path, text_path):
            with contextlib.suppress(Exception):
                path.unlink()

    # `send_files` returns one entry per uploaded file. The pipeline runs
    # once, so the agent's reply surfaces under whichever entry the SDK
    # attached it to — first non-empty wins.
    for entry in results:
        answer = first_answer_text(entry) if isinstance(entry, dict) else ""
        if answer:
            return answer
    return ""


@contextmanager
def capture_events_for_turn() -> Iterator[list[dict[str, Any]]]:
    """Activate the per-turn event buffer.

    Inside the `with` block, `record_runtime_event` appends to the
    buffer. After the block exits the buffer is detached so subsequent
    turns don't inherit stale events.
    """
    global current_turn_event_buffer
    buffer: list[dict[str, Any]] = []
    current_turn_event_buffer = buffer
    try:
        yield buffer
    finally:
        current_turn_event_buffer = None


def record_runtime_event(event_type: str, seq: Any, body: Any) -> None:
    """Append a runtime event to the active per-turn buffer (no-op outside).

    Called from `main.py`'s global event handler so the tracer file
    captures the same per-node invokes that Studio renders.
    """
    if current_turn_event_buffer is None:
        return
    current_turn_event_buffer.append(
        {
            "ts": datetime.now().isoformat(),
            "event": event_type,
            "seq": seq,
            "body": body,
        }
    )


# Black-box recorder for one chat turn — flushes raw SSE + runtime events
# + result + any terminating exception to today's date-stamped file under
# `logs/`. Nothing is filtered: the goal is to keep the full source
# material for later review.
def write_turn_trace(
    started: datetime,
    prompt: str,
    sse_events: list[dict[str, Any]],
    runtime_events: list[dict[str, Any]],
    result: dict[str, Any] | list[Any] | None,
    error: BaseException | None,
) -> None:
    """Append one run's tracer payload to ``logs/{YYYY-MM-DD}_tracer.log``."""
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


def extract_thinking_message(event_type: str, body: Any) -> str:
    """Pull a human-readable status line out of a 'thinking' SSE.

    Deep Agent emits `sendSSE('thinking', message=label, ...)` from its
    LangChain callback handler — labels like "LLM call started",
    "Calling tool_shell...", "Tool complete". Anything else returns ""
    so the UI never shows raw payloads.
    """
    if event_type != "thinking" or not isinstance(body, dict):
        return ""
    message = body.get("message")
    return message if isinstance(message, str) and message else ""


def first_answer_text(result: dict[str, Any]) -> str:
    """Extract the first answer string from a pipeline result dict."""
    answers = result.get("answers") or []
    if not answers:
        return ""
    first = answers[0]
    if isinstance(first, str):
        return first
    return str(first)

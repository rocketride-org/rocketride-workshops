"""Pipeline lifecycle and send helpers for the coding-agent pipeline.

A few RocketRide terms used throughout this file:

- **Source** — a door into the pipeline. The pipe declares one:
  `webhook_1`, which accepts typed text, audio, and images.
- **Token** — a boarding pass returned by `client.use(...)`. Every send
  call hands the token back so the engine knows which pipeline run you
  mean. Tokens go stale once the pipeline is idle longer than its TTL.
- **Lane** — a named conveyor belt between nodes. `webhook_1` emits on
  `audio`, `image`, and `text`. `question_1` normalizes those three
  into the `questions` lane that feeds the agent.

One pipeline instance handles every modality. Text turns are sent as
`text/plain` bytes through `client.send()`; audio + image turns send
their bytes with the matching mimetype.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, cast

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


# ID of the source node inside `coding-agent.pipe`. Must match the JSON.
WEBHOOK_SOURCE_ID = "webhook_1"


async def start_coding_agent() -> str:
    """Start the coding-agent pipeline and return its token.

    The pipe declares a single webhook source that fans into transcribe
    (audio), OCR (image), and a passthrough text lane. All three meet at
    `question_1` so the agent sees a uniform `questions` stream.
    """
    client = await get_client()
    logger.info("loading pipeline: %s (source=%s)", PIPELINE_PATH.name, WEBHOOK_SOURCE_ID)
    # ttl=0 disables the engine's idle-pipeline GC. Long deepagent fan-outs
    # otherwise push past the default idle window and the next call hits
    # "Your pipeline is not currently running."
    result = cast(
        dict[str, Any],
        await client.use(
            filepath=str(PIPELINE_PATH),
            source=WEBHOOK_SOURCE_ID,
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
    """Send a text turn through the webhook source. Returns the agent's answer.

    Typed text rides webhook -> `text` lane -> `question_1` -> agent.
    Same final shape as a transcribed audio or OCR'd image turn, so the
    agent sees a single source of truth regardless of modality.
    """
    client = await get_client()
    sse_events: list[dict[str, Any]] = []
    record_sse_event = make_sse_capture(sse_events, on_status)

    started = datetime.now()
    with capture_events_for_turn() as runtime_events:
        try:
            result = cast(
                dict[str, Any],
                await client.send(
                    token=token,
                    data=text.encode("utf-8"),
                    mimetype="text/plain",
                    objinfo={"mimetype": "text/plain"},
                    on_sse=record_sse_event,
                ),
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


# NOTE: `send_blob_with_text` and `preprocess_attachment` used to live here,
# along with an Anthropic vision-describe call for raster images. The
# product decision is that each user message is text-only OR attachment-only
# (the UI enforces this via composer mutex; the WS handler enforces it by
# rejecting `blob-start` frames that include a `text` field). Combined-send
# code was removed; if you need to re-introduce it, see the plan file for
# the design path (custom multimodal mimetype + `data_conn.py` patch).


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
    """Extract the first answer string from a pipeline result dict.

    Handles both shapes the SDK has historically returned so this helper
    works across SDK versions and call sites:
      - `client.send()` direct return: `{"answers": [...]}`.
      - `client.send_files()` per-file entry:
        `{"action": ..., "filepath": ..., "result": {"answers": [...]}}` —
        the agent's reply is nested one level inside `result`.
    """
    if not isinstance(result, dict):
        return ""
    answers = result.get("answers") or []
    if not answers:
        nested = result.get("result")
        if isinstance(nested, dict):
            answers = nested.get("answers") or []
    if not answers:
        return ""
    first = answers[0]
    if isinstance(first, str):
        return first
    return str(first)


# Substring patterns that Deep Agent surfaces as the answer when an upstream
# provider SDK raises an unhandled exception. Each tuple is (needle, rewrite).
_KNOWN_ERROR_REWRITES: tuple[tuple[str, str], ...] = (
    (
        "Your credit balance is too low to access the Anthropic API",
        "The Anthropic API account is out of credits. Top up at "
        "https://console.anthropic.com/settings/billing and re-send the request.",
    ),
)


def humanize_answer(text: str) -> str:
    """Rewrite known upstream-SDK error stack traces into a user-facing reply.

    Deep Agent surfaces unhandled provider exceptions as the answer string
    (prefixed `Deep agent invoke failed: Exception: ...`). For known failure
    modes (e.g. Anthropic credit exhaustion) we substitute a plain one-line
    message so the UI shows something readable instead of a stack trace.
    Unmatched input is returned unchanged.
    """
    if not isinstance(text, str):
        return text
    for needle, message in _KNOWN_ERROR_REWRITES:
        if needle in text:
            return message
    return text

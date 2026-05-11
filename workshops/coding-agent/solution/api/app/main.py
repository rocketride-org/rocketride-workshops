"""Switchboard between the chat UI and the rocketride engine.

The FastAPI app at the heart of the workshop solution. It boots two
pipeline instances at startup (one per source door — see `chat.py`),
accepts a single WebSocket from the UI at `/api/ws/chat`, and routes
each frame to the right pipeline send:

- typed text → chat source via `send_text` → `client.chat()`
- audio/image blob → webhook source via `send_blob` → `client.send()`
- text + blob together → webhook source via `send_blob_with_text`
  → `client.send_files()`

Engine status, replies, and errors flow back over the same WebSocket
as JSON frames the UI hooks render.
"""

import asyncio
import contextlib
import json
import logging
import os
import re
import sys
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import (
    CodingTokens,
    connect_with_retry,
    disconnect,
    record_runtime_event,
    reset_client,
    send_blob,
    send_blob_with_text,
    send_text,
    set_event_handler,
    start_coding_agent,
)


class SecretScrubFilter(logging.Filter):
    """Replace known secret values with ***REDACTED*** in every log record.

    Snapshots env-var secrets at construction. Also matches generated
    runtime tokens (pk_/tk_/sk-) by regex so per-pipeline keys never
    appear in stdout or log files.
    """

    REDACTED = "***REDACTED***"
    _SECRET_VARS = ("ROCKETRIDE_APIKEY", "ROCKETRIDE_ANTHROPIC_KEY")
    _MIN_LENGTH = 4
    _PATTERNS = (
        re.compile(r"\bpk_[A-Za-z0-9]{16,}\b"),
        re.compile(r"\btk_[A-Za-z0-9]{16,}\b"),
        re.compile(r"\bsk-(?:ant-)?[A-Za-z0-9_\-]{20,}\b"),
    )

    def __init__(self) -> None:
        super().__init__()
        self._secrets = [
            value
            for value in (os.environ.get(name) for name in self._SECRET_VARS)
            if value and len(value) >= self._MIN_LENGTH
        ]

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        scrubbed = message
        for secret in self._secrets:
            if secret in scrubbed:
                scrubbed = scrubbed.replace(secret, self.REDACTED)
        for pattern in self._PATTERNS:
            scrubbed = pattern.sub(self.REDACTED, scrubbed)
        if scrubbed != message:
            record.msg = scrubbed
            record.args = ()
        return True


_RUNTIME_FORMATTER = logging.Formatter(
    "\x1b[35;1mruntime\x1b[0m \x1b[36mdev:\x1b[0m %(levelname)s:     %(message)s"
)


def _open_console_stream() -> Any:
    """Open the controlling console directly so engine logs bypass the
    parent-process stdout pipe (`pnpm --parallel` adds a per-workspace
    prefix). Falls back to stderr when no tty is attached."""
    try:
        path = "CON" if sys.platform == "win32" else "/dev/tty"
        return open(path, "w", buffering=1, encoding="utf-8")
    except OSError:
        return sys.stderr


def _make_runtime_logger() -> logging.Logger:
    log = logging.getLogger("rocketride-runtime")
    log.setLevel(logging.INFO)
    log.propagate = False
    if not log.handlers:
        handler = logging.StreamHandler(_open_console_stream())
        handler.setFormatter(_RUNTIME_FORMATTER)
        handler.addFilter(SecretScrubFilter())
        log.addHandler(handler)
    return log


logging.basicConfig(level=logging.INFO)
logging.getLogger().addFilter(SecretScrubFilter())
logger = logging.getLogger("coding-agent")
runtime_logger = _make_runtime_logger()

OUTPUT_DIR = Path(__file__).resolve().parents[2] / ".output"


# Tracer = a flight data recorder for one chat turn — every node's input,
# output, and status, in JSON. Studio renders it as the execution graph.
# Per-second cpu/mem heartbeats are pure noise and balloon the file, so we
# never let them hit either the tracer or the live console. Everything
# else flows verbatim to both — keeping the workshop trace dense enough
# to debug an intentionally-broken pipeline live.
EVENTS_NEVER_LOGGED = frozenset({"apaevt_status_update"})
EVENTS_HIDDEN_FROM_CONSOLE = frozenset({"apaevt_status_update"})

LOG_PAYLOAD_MAX_CHARS = 200


def truncate(value: Any, n: int = LOG_PAYLOAD_MAX_CHARS) -> str:
    """Stringify and ellipsize for log readability."""
    s = "" if value is None else str(value)
    return s if len(s) <= n else s[: n - 1] + "…"


def format_node_event(seq: Any, event: str, body: Any) -> str:
    name = body.get("name") if isinstance(body, dict) else None
    status = body.get("status") if isinstance(body, dict) else None
    return f"seq={seq} {event} name={name} status={status}"


def format_node_error_event(seq: Any, event: str, body: Any) -> str:
    name = body.get("name") if isinstance(body, dict) else None
    err: Any = None
    if isinstance(body, dict):
        err = body.get("error") or body.get("message")
    return f"seq={seq} {event} name={name} error={truncate(err, 160)}"


def format_sse_event(seq: Any, event: str, body: Any) -> str:
    if isinstance(body, dict):
        sub = body.get("event_type") or body.get("type")
        msg = body.get("message") or body.get("text")
        return f"seq={seq} {event} {sub} {truncate(msg, 160)}"
    return f"seq={seq} {event} {truncate(body, 160)}"


RUNTIME_EVENT_FORMATTERS: dict[str, Callable[[Any, str, Any], str]] = {
    "apaevt_node_started": format_node_event,
    "apaevt_node_finished": format_node_event,
    "apaevt_node_error": format_node_error_event,
    "apaevt_sse": format_sse_event,
}


async def handle_runtime_event(message: dict[str, Any]) -> None:
    """SDK hands us every engine runtime event here. Tee into the per-turn
    tracer buffer first, then write a human-readable line to the console
    (unless the event is on the suppression list)."""
    event_type = message.get("event") or "?"
    seq = message.get("seq")
    body = message.get("body")
    if event_type not in EVENTS_NEVER_LOGGED:
        record_runtime_event(event_type, seq, body)
    if event_type in EVENTS_HIDDEN_FROM_CONSOLE:
        return
    formatter = RUNTIME_EVENT_FORMATTERS.get(event_type)
    if formatter:
        runtime_logger.info("%s", formatter(seq, event_type, body))
    else:
        runtime_logger.info("seq=%s %s %s", seq, event_type, truncate(repr(body)))


# ----------------------------------------------------------------------------
# Pipeline lifecycle: start the engine connection + pipelines in the
# background so uvicorn binds the listener immediately.
# ----------------------------------------------------------------------------


async def start_pipelines_with_retry(app: FastAPI) -> None:
    """Connect + load pipelines with backoff. Retries forever until success
    or the lifespan tears down."""
    delay = 5.0
    attempt = 0
    while True:
        attempt += 1
        try:
            await connect_with_retry()
            tokens = await start_coding_agent()
            app.state.coding_tokens = tokens
            cast(asyncio.Event, app.state.coding_ready).set()
            logger.info("coding pipelines started, tokens=%s", tokens)
            return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "coding pipeline init failed (attempt %d): %s — retrying in %.0fs",
                attempt,
                exc,
                delay,
                exc_info=(attempt == 1),
            )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 60.0)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["ROCKETRIDE_OUTPUT_DIR"] = str(OUTPUT_DIR).replace("\\", "/")
    # Exposed to subagent prompts via `${ROCKETRIDE_HOST_OS}`. Engineers and
    # DevOps consult this to pick the right binaries (git/node vs cmd
    # builtins) and avoid shell-builtin commands that fail without shell mode.
    os.environ["ROCKETRIDE_HOST_OS"] = {
        "win32": "windows",
        "darwin": "macos",
    }.get(sys.platform, "linux")
    logger.info(
        "ROCKETRIDE_OUTPUT_DIR=%s ROCKETRIDE_HOST_OS=%s",
        os.environ["ROCKETRIDE_OUTPUT_DIR"],
        os.environ["ROCKETRIDE_HOST_OS"],
    )
    set_event_handler(handle_runtime_event)
    app.state.coding_tokens = None
    app.state.coding_ready = asyncio.Event()
    init_task: asyncio.Task[None] = asyncio.create_task(start_pipelines_with_retry(app))
    try:
        yield
    finally:
        if not init_task.done():
            init_task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await init_task
        set_event_handler(None)
        try:
            await disconnect()
        except Exception:
            logger.exception("disconnect failed")


app = FastAPI(title="coding-agent solution", lifespan=lifespan)


class HealthResponse(BaseModel):
    status: str
    pipeline: str


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    coding = getattr(app.state, "coding_tokens", None)
    state = "ready" if coding else "unavailable"
    return HealthResponse(status="ok", pipeline=state)


# ----------------------------------------------------------------------------
# Recovery: rebuild the engine connection + pipelines if the WS dies.
# ----------------------------------------------------------------------------

pipeline_recovery_lock = asyncio.Lock()


def is_engine_disconnect(exc: BaseException) -> bool:
    """Did this exception come from a dead engine WS or transport?"""
    if isinstance(exc, ConnectionError | OSError | TimeoutError):
        return True
    # The DAP layer raises plain RuntimeError("Server is not connected") /
    # ConnectionError("Could not send request") — match those by message
    # so we don't catch unrelated runtime errors.
    if isinstance(exc, RuntimeError):
        msg = str(exc).lower()
        return (
            "not connected" in msg
            or "could not send request" in msg
            or "pipeline is not currently running" in msg
        )
    return False


# Like restarting a printer that froze mid-print — drop the dead client,
# reconnect, and re-issue both pipelines so the next turn routes to the
# new tokens. The lock keeps two concurrent recoveries from racing.
async def restart_pipelines_after_drop() -> CodingTokens | None:
    """Return the new tokens dict, or None if recovery failed."""
    async with pipeline_recovery_lock:
        existing = getattr(app.state, "coding_tokens", None)
        if existing and existing != getattr(app.state, "_coding_recovering_from", None):
            return cast(CodingTokens, existing)
        app.state._coding_recovering_from = existing
        logger.warning("coding engine connection lost — attempting recovery")
        try:
            await reset_client()
            await connect_with_retry()
            new_tokens = await start_coding_agent()
        except Exception:
            logger.exception("coding pipeline recovery failed")
            return None
        app.state.coding_tokens = new_tokens
        app.state._coding_recovering_from = None
        logger.info("coding pipelines recovered, new tokens=%s", new_tokens)
        return new_tokens


# ----------------------------------------------------------------------------
# WebSocket handler.
# ----------------------------------------------------------------------------

STATUS_FRAME_THROTTLE_SECONDS = 0.25  # ~4 Hz max
MAX_BLOB_BYTES = 25 * 1024 * 1024  # 25 MB cap on uploaded audio/image
SUPPORTED_BLOB_CHANNELS = frozenset({"audio", "image"})


async def wait_until_pipelines_ready(websocket: WebSocket) -> CodingTokens | None:
    """Block until pipeline init completes. Sends one warm-up status so
    the UI doesn't sit silently. Returns None only if the lifespan tore
    down before init landed."""
    event: asyncio.Event | None = getattr(websocket.app.state, "coding_ready", None)
    tokens: CodingTokens | None = getattr(websocket.app.state, "coding_tokens", None)
    if tokens:
        return tokens
    if event is None:
        return None
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.send_json(
            {
                "type": "status",
                "text": "warming up coding pipeline — first reply takes longer…",
            }
        )
    await event.wait()
    return cast("CodingTokens | None", getattr(websocket.app.state, "coding_tokens", None))


@app.websocket("/api/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    """One WebSocket per browser tab. Single user, one turn at a time.

    Inbound frames (UI → server):

    - `{"type": "text", "text": <str>}` — typed message; runs through the
      chat source.
    - `{"type": "blob-start", "channel": "audio"|"image", "mimetype": ...,
       "name"?: ..., "text"?: <caption>}` — opens a binary upload.
    - Binary frames — appended to the open blob's buffer.
    - `{"type": "blob-end"}` — closes the upload; runs through the webhook
      source. If `text` was set on `blob-start`, the typed caption travels
      with the blob as a combined turn.

    Outbound frames (server → UI):

    - `{"type": "status", "text": ...}` — periodic during a turn.
    - `{"type": "reply", "text": ...}` — terminal: agent's answer.
    - `{"type": "error", "message": ...}` — terminal: surface engine error.
    - `{"type": "cancelled", "reason": ...}` — terminal: turn aborted.

    Each turn always emits exactly one terminal frame.
    """
    await websocket.accept()
    send_lock = asyncio.Lock()
    last_status_at = 0.0

    async def send_to_ui(payload: dict[str, Any]) -> None:
        async with send_lock:
            try:  # noqa: SIM105 — `contextlib.suppress` is sync-only, can't pair with `async with`
                await websocket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                pass  # client gone; drop silently

    async def send_status_frame(text: str) -> None:
        nonlocal last_status_at
        now = asyncio.get_event_loop().time()
        if now - last_status_at < STATUS_FRAME_THROTTLE_SECONDS:
            return
        last_status_at = now
        await send_to_ui({"type": "status", "text": text})

    async def send_error_frame(message: str) -> None:
        await send_to_ui({"type": "error", "message": message})

    async def wait_for_pipeline_tokens() -> CodingTokens | None:
        tokens: CodingTokens | None = getattr(websocket.app.state, "coding_tokens", None)
        if tokens:
            return tokens
        return await wait_until_pipelines_ready(websocket)

    async def send_with_engine_recovery(kind: str, do_send: Callable[[str], Awaitable[str]]) -> str:
        """Run a token-bound coroutine; if the engine WS drops, restart
        the pipelines once and retry. `kind` is "chat" or "webhook"."""
        tokens = await wait_for_pipeline_tokens()
        token = tokens.get(kind) if tokens else None
        if not token:
            raise RuntimeError(f"coding pipeline ({kind}) not available")

        try:
            return await do_send(token)
        except Exception as exc:
            if not is_engine_disconnect(exc):
                raise
            await send_status_frame("connection lost — restarting pipeline…")
            new_tokens = await restart_pipelines_after_drop()
            new_token = new_tokens.get(kind) if new_tokens else None
            if not new_token:
                raise
            return await do_send(new_token)

    async def run_pipeline_turn(kind: str, do_send: Callable[[str], Awaitable[str]]) -> None:
        """One user turn. Always emits exactly one terminal frame
        (reply | error | cancelled), even if the inner send raises or the
        WS drops mid-turn."""
        terminal_sent = False

        async def send_terminal_frame(payload: dict[str, Any]) -> None:
            nonlocal terminal_sent
            if terminal_sent:
                return
            terminal_sent = True
            await send_to_ui(payload)

        try:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            reply = await send_with_engine_recovery(kind, do_send)
            await send_terminal_frame({"type": "reply", "text": reply})
        except asyncio.CancelledError:
            await send_terminal_frame(
                {"type": "cancelled", "reason": "pipeline restarted — re-send your message"}
            )
            raise
        except Exception as exc:
            logger.exception("coding turn failed")
            await send_terminal_frame({"type": "error", "message": str(exc)})
        finally:
            if not terminal_sent:
                await send_terminal_frame({"type": "error", "message": "turn ended without reply"})

    async def run_text_turn(text: str) -> None:
        async def do(token: str) -> str:
            return await send_text(token, text, on_status=send_status_frame)

        await run_pipeline_turn("chat", do)

    async def run_blob_turn(
        channel: str,
        mimetype: str,
        data: bytes,
        name: str | None,
        text: str | None,
    ) -> None:
        caption = (text or "").strip()

        async def do(token: str) -> str:
            label = f"{channel} ({len(data)} bytes)"
            if caption:
                label += f" + caption ({len(caption)} chars)"
            await send_status_frame(f"uploaded {label} — running pipeline…")
            if caption:
                return await send_blob_with_text(
                    token, caption, data, mimetype, on_status=send_status_frame, name=name
                )
            return await send_blob(token, data, mimetype, on_status=send_status_frame, name=name)

        await run_pipeline_turn("webhook", do)

    # Blob = a complete binary file (audio recording, picked image). The
    # client streams it to us in WebSocket binary frames between a
    # `blob-start` and `blob-end` envelope; we buffer the bytes here and
    # forward the assembled whole to the pipeline.
    pending_blob: dict[str, Any] | None = None

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                return
            data_bytes = message.get("bytes")
            if data_bytes is not None:
                if pending_blob is None:
                    continue  # stray binary frame; drop
                if len(pending_blob["buf"]) + len(data_bytes) > MAX_BLOB_BYTES:
                    cap_mb = MAX_BLOB_BYTES // (1024 * 1024)
                    pending_blob = None
                    await send_error_frame(f"upload exceeded {cap_mb} MB cap; cancelled")
                    continue
                pending_blob["buf"].extend(data_bytes)
                continue
            data_text = message.get("text")
            if data_text is None:
                continue
            try:
                event = json.loads(data_text)
            except json.JSONDecodeError:
                continue
            event_type = event.get("type")
            if event_type == "text":
                text = event.get("text") or ""
                if not text:
                    continue
                await run_text_turn(text)
            elif event_type == "blob-start":
                channel = event.get("channel")
                mimetype = event.get("mimetype")
                name = event.get("name")
                text = event.get("text")
                if channel not in SUPPORTED_BLOB_CHANNELS:
                    await send_error_frame(f"unsupported blob channel: {channel!r}")
                    continue
                if not isinstance(mimetype, str) or not mimetype:
                    await send_error_frame("blob-start missing mimetype")
                    continue
                pending_blob = {
                    "channel": channel,
                    "mimetype": mimetype,
                    "name": name if isinstance(name, str) else None,
                    "text": text if isinstance(text, str) else None,
                    "buf": bytearray(),
                }
            elif event_type == "blob-end":
                if pending_blob is None:
                    continue
                snap = pending_blob
                pending_blob = None
                if not snap["buf"]:
                    await send_error_frame(f"empty {snap['channel']} blob; nothing to send")
                    continue
                await run_blob_turn(
                    snap["channel"],
                    snap["mimetype"],
                    bytes(snap["buf"]),
                    snap["name"],
                    snap["text"],
                )
    except WebSocketDisconnect:
        return

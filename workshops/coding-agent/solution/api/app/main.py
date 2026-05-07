import asyncio
import contextlib
import json
import logging
import os
import re
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import (
    connect_with_retry,
    disconnect,
    reset_client,
    send_audio,
    send_text,
    set_event_handler,
    start_chat_only,
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
    """Open the controlling console directly so output bypasses any
    parent-process stdout pipe (pnpm `--parallel` adds a per-workspace
    prefix). Falls back to stderr when no tty is attached.
    """
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


# Engine emits these every second per node (cpu/memory/gpu metrics) and they
# drown the dev console without adding signal. Skip them outright.
_RUNTIME_EVENT_NOISE = frozenset({"apaevt_status_update"})


async def _on_runtime_event(message: dict[str, Any]) -> None:
    event_type = message.get("event")
    if event_type in _RUNTIME_EVENT_NOISE:
        return
    body = message.get("body")
    if event_type == "apaevt_sse":
        runtime_logger.info("[SSE-INSPECT] seq=%s body=%r", message.get("seq"), body)
        return
    runtime_logger.info("seq=%s %s %s", message.get("seq"), event_type, body)


# ----------------------------------------------------------------------------
# Pipeline lifecycle: two pipelines (coding + chat-only) initialized in the
# background so uvicorn binds the listener immediately.
# ----------------------------------------------------------------------------


def _starter_for(label: str):
    return start_coding_agent if label == "coding" else start_chat_only


async def _init_one_pipeline(app: FastAPI, label: str) -> None:
    """Start one pipeline with backoff retry until it succeeds or cancelled."""
    starter = _starter_for(label)
    delay = 5.0
    attempt = 0
    while True:
        attempt += 1
        try:
            await connect_with_retry()
            token = await starter()
            setattr(app.state, f"{label}_token", token)
            event = cast(asyncio.Event, getattr(app.state, f"{label}_ready"))
            event.set()
            logger.info("%s pipeline started, token=%s", label, token)
            return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # Show full traceback on first failure (most useful for debugging
            # a broken pipe file), terse on retries to reduce log spam.
            logger.warning(
                "%s pipeline init failed (attempt %d): %s — retrying in %.0fs",
                label,
                attempt,
                exc,
                delay,
                exc_info=(attempt == 1),
            )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 60.0)


async def _init_pipelines(app: FastAPI) -> None:
    """Boot both pipelines in parallel so coding and chat are usable
    independently as soon as each is ready."""
    logger.info("starting coding-agent + chat-only pipelines (cold start may take a while)...")
    await asyncio.gather(
        _init_one_pipeline(app, "coding"),
        _init_one_pipeline(app, "chat"),
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["ROCKETRIDE_OUTPUT_DIR"] = str(OUTPUT_DIR).replace("\\", "/")
    logger.info("ROCKETRIDE_OUTPUT_DIR=%s", os.environ["ROCKETRIDE_OUTPUT_DIR"])
    set_event_handler(_on_runtime_event)
    app.state.coding_token = None
    app.state.chat_token = None
    app.state.coding_ready = asyncio.Event()
    app.state.chat_ready = asyncio.Event()
    init_task: asyncio.Task[None] = asyncio.create_task(_init_pipelines(app))
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
    coding = getattr(app.state, "coding_token", None)
    chat = getattr(app.state, "chat_token", None)
    if coding and chat:
        state = "ready"
    elif coding or chat:
        state = "partial"
    else:
        state = "unavailable"
    return HealthResponse(status="ok", pipeline=state)


# ----------------------------------------------------------------------------
# Recovery: reconnect + restart pipelines when the engine WS dies.
# ----------------------------------------------------------------------------

_recover_lock = asyncio.Lock()


def _is_disconnect_error(exc: BaseException) -> bool:
    """True when the exception comes from a dead engine WS or transport."""
    if isinstance(exc, ConnectionError | OSError | TimeoutError):
        return True
    # The DAP layer raises plain RuntimeError("Server is not connected") /
    # ConnectionError("Could not send request"). Match those by name to be
    # defensive without catching unrelated runtime errors.
    if isinstance(exc, RuntimeError):
        msg = str(exc).lower()
        return "not connected" in msg or "could not send request" in msg
    return False


async def _recover_pipeline(label: str) -> str | None:
    """Engine WS dropped. Drop the cached client, reconnect, restart the
    requested pipeline, and publish the new token. Returns the new token,
    or None if recovery failed."""
    async with _recover_lock:
        token_attr = f"{label}_token"
        existing = getattr(app.state, token_attr, None)
        if existing and existing != getattr(app.state, f"_{label}_recovering_from", None):
            return cast(str, existing)
        setattr(app.state, f"_{label}_recovering_from", existing)
        logger.warning("%s engine connection lost — attempting recovery", label)
        try:
            await reset_client()
            await connect_with_retry()
            starter = _starter_for(label)
            new_token = await starter()
        except Exception:
            logger.exception("%s pipeline recovery failed", label)
            return None
        setattr(app.state, token_attr, new_token)
        setattr(app.state, f"_{label}_recovering_from", None)
        logger.info("%s pipeline recovered, new token=%s", label, new_token)
        return new_token


# ----------------------------------------------------------------------------
# WebSocket handler: per-turn intent classification + terminal-frame guarantee.
# ----------------------------------------------------------------------------

_PIPELINE_WAIT_SECONDS = 180.0
_LEGACY_TURN_TIMEOUT = os.environ.get("PIPELINE_TURN_TIMEOUT")
_TURN_TIMEOUTS: dict[str, float] = {
    "chat": float(os.environ.get("CHAT_TURN_TIMEOUT", _LEGACY_TURN_TIMEOUT or "60")),
    "coding": float(os.environ.get("CODING_TURN_TIMEOUT", _LEGACY_TURN_TIMEOUT or "1800")),
}
_STATUS_THROTTLE_SECONDS = 0.25  # ~4 Hz max
_CODING_VERBS = (
    "build",
    "write",
    "run",
    "fix",
    "implement",
    "refactor",
    "deploy",
    "spawn",
    "scaffold",
    "commit",
    "stage",
    "push",
    "install",
)


def _classify_intent(text: str) -> str:
    """Return 'coding' or 'chat'. Cheap, conservative heuristic:
    long messages (>80 chars) or short messages whose first word is a
    coding verb route to the coding agent. Everything else (yes/no,
    clarifications, explanations, "what does that mean") goes to the
    chat-only pipeline for fast turnaround.
    """
    stripped = text.strip().lower()
    if not stripped:
        return "chat"
    if len(stripped) > 80:
        return "coding"
    first_word = re.split(r"\W+", stripped, maxsplit=1)[0]
    if first_word in _CODING_VERBS:
        return "coding"
    return "chat"


async def _await_pipeline_ready(websocket: WebSocket, label: str) -> str | None:
    """Wait for the named pipeline's asyncio.Event, sending one warm-up
    status frame so the UI doesn't sit silently."""
    event: asyncio.Event | None = getattr(websocket.app.state, f"{label}_ready", None)
    token: str | None = getattr(websocket.app.state, f"{label}_token", None)
    if token:
        return token
    if event is None:
        return None
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.send_json(
            {
                "type": "status",
                "text": f"warming up {label} pipeline — first reply takes longer…",
            }
        )
    try:
        await asyncio.wait_for(event.wait(), timeout=_PIPELINE_WAIT_SECONDS)
    except TimeoutError:
        return None
    return cast(str | None, getattr(websocket.app.state, f"{label}_token", None))


@app.websocket("/api/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    buffer = bytearray()
    send_lock = asyncio.Lock()
    last_status_at = 0.0

    async def _send_safe(payload: dict[str, Any]) -> None:
        async with send_lock:
            try:  # noqa: SIM105 — `contextlib.suppress` is sync-only, can't pair with `async with`
                await websocket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                pass  # client gone; drop silently

    async def _emit_status(text: str) -> None:
        nonlocal last_status_at
        now = asyncio.get_event_loop().time()
        if now - last_status_at < _STATUS_THROTTLE_SECONDS:
            return
        last_status_at = now
        await _send_safe({"type": "status", "text": text})

    async def _resolve_token(label: str) -> str | None:
        token: str | None = getattr(websocket.app.state, f"{label}_token", None)
        if token:
            return token
        return await _await_pipeline_ready(websocket, label)

    async def _send_with_recovery(label: str, payload: bytes | str) -> str:
        """Run send_text/send_audio against the named pipeline, recovering
        once if the engine WS drops mid-request."""
        token = await _resolve_token(label)
        if not token:
            raise RuntimeError(f"{label} pipeline not available")

        async def _do_send(active_token: str) -> str:
            if isinstance(payload, str):
                return await send_text(active_token, payload, on_status=_emit_status)
            return await send_audio(active_token, payload, on_status=_emit_status)

        try:
            return await _do_send(token)
        except Exception as exc:
            if not _is_disconnect_error(exc):
                raise
            await _emit_status("connection lost — restarting pipeline…")
            new_token = await _recover_pipeline(label)
            if not new_token:
                raise
            return await _do_send(new_token)

    async def _run_turn(label: str, payload: bytes | str) -> None:
        """Run one user turn through the chosen pipeline. Always emits
        exactly one terminal frame (reply | error | cancelled), even if
        the inner send raises, the engine times out, or the WS drops."""
        terminal_sent = False

        async def _emit_terminal(payload: dict[str, Any]) -> None:
            nonlocal terminal_sent
            if terminal_sent:
                return
            terminal_sent = True
            await _send_safe(payload)

        turn_timeout = _TURN_TIMEOUTS.get(label, 1800.0)
        try:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            reply = await asyncio.wait_for(
                _send_with_recovery(label, payload),
                timeout=turn_timeout,
            )
            await _emit_terminal({"type": "reply", "text": reply})
        except TimeoutError:
            logger.warning(
                "%s turn exceeded %.0fs timeout; cancelling",
                label,
                turn_timeout,
            )
            await _emit_terminal(
                {
                    "type": "error",
                    "message": f"{label} pipeline took longer than {int(turn_timeout)}s — cancelled",
                }
            )
        except asyncio.CancelledError:
            await _emit_terminal(
                {"type": "cancelled", "reason": "pipeline restarted — re-send your message"}
            )
            raise
        except Exception as exc:
            logger.exception("%s turn failed", label)
            await _emit_terminal({"type": "error", "message": str(exc)})
        finally:
            # Backstop: guarantee the UI always sees a terminal even if the
            # paths above missed somehow.
            if not terminal_sent:
                await _emit_terminal({"type": "error", "message": "turn ended without reply"})

    try:
        while True:
            message = await websocket.receive()
            data_bytes = message.get("bytes")
            if data_bytes is not None:
                buffer.extend(data_bytes)
                continue
            data_text = message.get("text")
            if data_text is None:
                continue
            try:
                event = json.loads(data_text)
            except json.JSONDecodeError:
                continue
            event_type = event.get("type")
            if event_type == "start":
                buffer.clear()
            elif event_type == "end":
                audio = bytes(buffer)
                buffer.clear()
                # Voice always uses the coding pipeline (it owns audio_transcribe).
                await _run_turn("coding", audio)
            elif event_type == "text":
                text = event.get("text") or ""
                if not text:
                    continue
                label = _classify_intent(text)
                logger.info("routing turn label=%s text=%r", label, text[:80])
                await _run_turn(label, text)
    except WebSocketDisconnect:
        return

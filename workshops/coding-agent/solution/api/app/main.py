import asyncio
import contextlib
import json
import logging
import os
import re
import sys
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import (
    connect_with_retry,
    disconnect,
    reset_client,
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

_BODY_TRUNCATE = 200


def _trunc(value: Any, n: int = _BODY_TRUNCATE) -> str:
    s = "" if value is None else str(value)
    return s if len(s) <= n else s[: n - 1] + "…"


def _fmt_node(seq: Any, event: str, body: Any) -> str:
    name = body.get("name") if isinstance(body, dict) else None
    status = body.get("status") if isinstance(body, dict) else None
    return f"seq={seq} {event} name={name} status={status}"


def _fmt_node_error(seq: Any, event: str, body: Any) -> str:
    name = body.get("name") if isinstance(body, dict) else None
    err: Any = None
    if isinstance(body, dict):
        err = body.get("error") or body.get("message")
    return f"seq={seq} {event} name={name} error={_trunc(err, 160)}"


def _fmt_sse(seq: Any, event: str, body: Any) -> str:
    if isinstance(body, dict):
        sub = body.get("event_type") or body.get("type")
        msg = body.get("message") or body.get("text")
        return f"seq={seq} {event} {sub} {_trunc(msg, 160)}"
    return f"seq={seq} {event} {_trunc(body, 160)}"


_RUNTIME_EVENT_FORMATTERS: dict[str, Callable[[Any, str, Any], str]] = {
    "apaevt_node_started": _fmt_node,
    "apaevt_node_finished": _fmt_node,
    "apaevt_node_error": _fmt_node_error,
    "apaevt_sse": _fmt_sse,
}


async def _on_runtime_event(message: dict[str, Any]) -> None:
    event_type = message.get("event") or "?"
    if event_type in _RUNTIME_EVENT_NOISE:
        return
    seq = message.get("seq")
    body = message.get("body")
    formatter = _RUNTIME_EVENT_FORMATTERS.get(event_type)
    if formatter:
        runtime_logger.info("%s", formatter(seq, event_type, body))
        return
    runtime_logger.info("seq=%s %s %s", seq, event_type, _trunc(repr(body)))


# ----------------------------------------------------------------------------
# Pipeline lifecycle: single coding-agent pipeline initialized in the
# background so uvicorn binds the listener immediately.
# ----------------------------------------------------------------------------


async def _init_pipeline(app: FastAPI) -> None:
    """Start the coding-agent pipeline with backoff retry until it succeeds or
    is cancelled."""
    delay = 5.0
    attempt = 0
    while True:
        attempt += 1
        try:
            await connect_with_retry()
            token = await start_coding_agent()
            app.state.coding_token = token
            cast(asyncio.Event, app.state.coding_ready).set()
            logger.info("coding pipeline started, token=%s", token)
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
    logger.info("ROCKETRIDE_OUTPUT_DIR=%s", os.environ["ROCKETRIDE_OUTPUT_DIR"])
    set_event_handler(_on_runtime_event)
    app.state.coding_token = None
    app.state.coding_ready = asyncio.Event()
    init_task: asyncio.Task[None] = asyncio.create_task(_init_pipeline(app))
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
    state = "ready" if coding else "unavailable"
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
        return (
            "not connected" in msg
            or "could not send request" in msg
            or "pipeline is not currently running" in msg
        )
    return False


async def _recover_pipeline() -> str | None:
    """Engine WS dropped. Drop the cached client, reconnect, restart the
    coding pipeline, and publish the new token. Returns the new token, or
    None if recovery failed."""
    async with _recover_lock:
        existing = getattr(app.state, "coding_token", None)
        if existing and existing != getattr(app.state, "_coding_recovering_from", None):
            return cast(str, existing)
        app.state._coding_recovering_from = existing
        logger.warning("coding engine connection lost — attempting recovery")
        try:
            await reset_client()
            await connect_with_retry()
            new_token = await start_coding_agent()
        except Exception:
            logger.exception("coding pipeline recovery failed")
            return None
        app.state.coding_token = new_token
        app.state._coding_recovering_from = None
        logger.info("coding pipeline recovered, new token=%s", new_token)
        return new_token


# ----------------------------------------------------------------------------
# WebSocket handler: terminal-frame guarantee, single coding pipeline.
# ----------------------------------------------------------------------------

_PIPELINE_WAIT_SECONDS = 180.0
_TURN_TIMEOUT = float(
    os.environ.get(
        "CODING_TURN_TIMEOUT",
        os.environ.get("PIPELINE_TURN_TIMEOUT", "1800"),
    )
)
_STATUS_THROTTLE_SECONDS = 0.25  # ~4 Hz max


async def _await_pipeline_ready(websocket: WebSocket) -> str | None:
    """Wait for the coding pipeline's asyncio.Event, sending one warm-up
    status frame so the UI doesn't sit silently."""
    event: asyncio.Event | None = getattr(websocket.app.state, "coding_ready", None)
    token: str | None = getattr(websocket.app.state, "coding_token", None)
    if token:
        return token
    if event is None:
        return None
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await websocket.send_json(
            {
                "type": "status",
                "text": "warming up coding pipeline — first reply takes longer…",
            }
        )
    try:
        await asyncio.wait_for(event.wait(), timeout=_PIPELINE_WAIT_SECONDS)
    except TimeoutError:
        return None
    return cast(str | None, getattr(websocket.app.state, "coding_token", None))


@app.websocket("/api/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    await websocket.accept()
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

    async def _resolve_token() -> str | None:
        token: str | None = getattr(websocket.app.state, "coding_token", None)
        if token:
            return token
        return await _await_pipeline_ready(websocket)

    async def _send_with_recovery(payload: str) -> str:
        """Run send_text against the coding pipeline, recovering once if the
        engine WS drops mid-request."""
        token = await _resolve_token()
        if not token:
            raise RuntimeError("coding pipeline not available")

        async def _do_send(active_token: str) -> str:
            return await send_text(active_token, payload, on_status=_emit_status)

        try:
            return await _do_send(token)
        except Exception as exc:
            if not _is_disconnect_error(exc):
                raise
            await _emit_status("connection lost — restarting pipeline…")
            new_token = await _recover_pipeline()
            if not new_token:
                raise
            return await _do_send(new_token)

    async def _run_turn(payload: str) -> None:
        """Run one user turn through the coding pipeline. Always emits
        exactly one terminal frame (reply | error | cancelled), even if
        the inner send raises, the engine times out, or the WS drops."""
        terminal_sent = False

        async def _emit_terminal(payload: dict[str, Any]) -> None:
            nonlocal terminal_sent
            if terminal_sent:
                return
            terminal_sent = True
            await _send_safe(payload)

        try:
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            reply = await asyncio.wait_for(
                _send_with_recovery(payload),
                timeout=_TURN_TIMEOUT,
            )
            await _emit_terminal({"type": "reply", "text": reply})
        except TimeoutError:
            logger.warning("coding turn exceeded %.0fs timeout; cancelling", _TURN_TIMEOUT)
            await _emit_terminal(
                {
                    "type": "error",
                    "message": f"coding pipeline took longer than {int(_TURN_TIMEOUT)}s — cancelled",
                }
            )
        except asyncio.CancelledError:
            await _emit_terminal(
                {"type": "cancelled", "reason": "pipeline restarted — re-send your message"}
            )
            raise
        except Exception as exc:
            logger.exception("coding turn failed")
            await _emit_terminal({"type": "error", "message": str(exc)})
        finally:
            if not terminal_sent:
                await _emit_terminal({"type": "error", "message": "turn ended without reply"})

    try:
        while True:
            message = await websocket.receive()
            data_text = message.get("text")
            if data_text is None:
                continue
            try:
                event = json.loads(data_text)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "text":
                text = event.get("text") or ""
                if not text:
                    continue
                await _run_turn(text)
    except WebSocketDisconnect:
        return

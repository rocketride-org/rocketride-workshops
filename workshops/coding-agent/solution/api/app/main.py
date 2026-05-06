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


async def _on_runtime_event(message: dict[str, Any]) -> None:
    event_type = message.get("event")
    body = message.get("body")
    if event_type == "apaevt_sse":
        runtime_logger.info("[SSE-INSPECT] seq=%s body=%r", message.get("seq"), body)
        return
    runtime_logger.info("seq=%s %s %s", message.get("seq"), event_type, body)


async def _init_pipeline(app: FastAPI) -> None:
    """Connect to the engine and start the pipeline. Runs as a background
    task so the lifespan startup phase doesn't block uvicorn from binding
    the listener — without this, vite's proxy hits ECONNREFUSED for 30–60 s
    on every cold start while the engine + CrewAI come up."""
    logger.info("starting coding-agent pipeline (this may take a while on first launch)...")
    try:
        await connect_with_retry()
        app.state.chat_token = await start_coding_agent()
        logger.info("pipeline started, token=%s", app.state.chat_token)
    except Exception:
        logger.exception(
            "failed to start coding-agent pipeline; "
            "/api/ws/chat will return an error frame until recovery succeeds"
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["ROCKETRIDE_OUTPUT_DIR"] = str(OUTPUT_DIR).replace("\\", "/")
    logger.info("ROCKETRIDE_OUTPUT_DIR=%s", os.environ["ROCKETRIDE_OUTPUT_DIR"])
    set_event_handler(_on_runtime_event)
    app.state.chat_token = None
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
    pipeline = "ready" if getattr(app.state, "chat_token", None) else "unavailable"
    return HealthResponse(status="ok", pipeline=pipeline)


_recover_lock = asyncio.Lock()


def _is_disconnect_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "not connected" in msg or "could not send request" in msg


async def _recover_pipeline() -> str | None:
    """Engine WS dropped (e.g. agent killed a python process and took the
    runtime down with it). Drop the cached client, reconnect, restart the
    pipeline, and publish the new token on app.state. Returns the new
    token, or None if recovery failed."""
    async with _recover_lock:
        # If another concurrent request already recovered, reuse that token.
        existing = getattr(app.state, "chat_token", None)
        if existing and existing != getattr(app.state, "_recovering_from", None):
            return cast(str, existing)
        app.state._recovering_from = existing
        logger.warning("engine connection lost — attempting recovery")
        try:
            await reset_client()
            await connect_with_retry()
            new_token = await start_coding_agent()
        except Exception:
            logger.exception("pipeline recovery failed")
            return None
        app.state.chat_token = new_token
        app.state._recovering_from = None
        logger.info("pipeline recovered, new token=%s", new_token)
        return new_token


@app.websocket("/api/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    token: str | None = getattr(websocket.app.state, "chat_token", None)
    if not token:
        await websocket.send_json(
            {"type": "error", "message": "coding-agent pipeline not available"}
        )
        await websocket.close()
        return
    buffer = bytearray()
    send_lock = asyncio.Lock()

    async def _send_safe(payload: dict[str, Any]) -> None:
        async with send_lock:
            try:  # noqa: SIM105 — `contextlib.suppress` is sync-only, can't pair with `async with`
                await websocket.send_json(payload)
            except (RuntimeError, WebSocketDisconnect):
                pass  # client gone; drop silently

    async def _emit_status(text: str) -> None:
        await _send_safe({"type": "status", "text": text})

    async def _send_text_with_recovery(payload: str) -> str:
        nonlocal token
        assert token is not None
        try:
            return await send_text(token, payload, on_status=_emit_status)
        except Exception as exc:
            if not _is_disconnect_error(exc):
                raise
            await _emit_status("connection lost — restarting pipeline…")
            new_token = await _recover_pipeline()
            if not new_token:
                raise
            token = new_token
            return await send_text(token, payload, on_status=_emit_status)

    async def _send_audio_with_recovery(audio: bytes) -> str:
        nonlocal token
        assert token is not None
        try:
            return await send_audio(token, audio, on_status=_emit_status)
        except Exception as exc:
            if not _is_disconnect_error(exc):
                raise
            await _emit_status("connection lost — restarting pipeline…")
            new_token = await _recover_pipeline()
            if not new_token:
                raise
            token = new_token
            return await send_audio(token, audio, on_status=_emit_status)

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
                try:
                    reply = await _send_audio_with_recovery(bytes(buffer))
                    await _send_safe({"type": "reply", "text": reply})
                except Exception as exc:
                    logger.exception("send_audio failed")
                    await _send_safe({"type": "error", "message": str(exc)})
                finally:
                    buffer.clear()
            elif event_type == "text":
                text = event.get("text") or ""
                if not text:
                    continue
                try:
                    reply = await _send_text_with_recovery(text)
                    await _send_safe({"type": "reply", "text": reply})
                except Exception as exc:
                    logger.exception("send_text failed")
                    await _send_safe({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        return

import asyncio
import json
import logging
import os
import re
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import (
    connect_with_retry,
    disconnect,
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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["ROCKETRIDE_OUTPUT_DIR"] = str(OUTPUT_DIR).replace("\\", "/")
    logger.info("ROCKETRIDE_OUTPUT_DIR=%s", os.environ["ROCKETRIDE_OUTPUT_DIR"])
    logger.info("starting coding-agent pipeline (this may take a while on first launch)...")
    set_event_handler(_on_runtime_event)
    app.state.chat_token = None
    try:
        await connect_with_retry()
        app.state.chat_token = await start_coding_agent()
        logger.info("pipeline started, token=%s", app.state.chat_token)
    except Exception:
        logger.exception(
            "failed to start coding-agent pipeline; "
            "API will respond to /api/health but /api/ws/chat will return an error frame"
        )
    try:
        yield
    finally:
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
                async with send_lock:
                    try:
                        reply = await send_audio(token, bytes(buffer))
                        await websocket.send_json({"type": "reply", "text": reply})
                    except Exception as exc:
                        logger.exception("send_audio failed")
                        await websocket.send_json({"type": "error", "message": str(exc)})
                    finally:
                        buffer.clear()
            elif event_type == "text":
                text = event.get("text") or ""
                if not text:
                    continue
                async with send_lock:
                    try:
                        reply = await send_text(token, text)
                        await websocket.send_json({"type": "reply", "text": reply})
                    except Exception as exc:
                        logger.exception("send_text failed")
                        await websocket.send_json({"type": "error", "message": str(exc)})
    except WebSocketDisconnect:
        return

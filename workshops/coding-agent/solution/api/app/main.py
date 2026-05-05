import json
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import disconnect, send_audio, send_text, start_coding_agent

logger = logging.getLogger("coding-agent")
logging.basicConfig(level=logging.INFO)

OUTPUT_DIR = Path(__file__).resolve().parents[1] / ".output"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["ROCKETRIDE_OUTPUT_DIR"] = str(OUTPUT_DIR).replace("\\", "/")
    logger.info("ROCKETRIDE_OUTPUT_DIR=%s", os.environ["ROCKETRIDE_OUTPUT_DIR"])
    logger.info("starting coding-agent pipeline (this may take a while on first launch)...")
    app.state.chat_token = None
    try:
        app.state.chat_token = await start_coding_agent()
        logger.info("pipeline started, token=%s", app.state.chat_token)
    except Exception:
        logger.exception(
            "failed to start coding-agent pipeline; "
            "API will respond to /health but /api/chat will return 503 until restarted"
        )
    try:
        yield
    finally:
        try:
            await disconnect()
        except Exception:
            logger.exception("disconnect failed")


app = FastAPI(title="coding-agent solution", lifespan=lifespan)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


class HealthResponse(BaseModel):
    status: str
    pipeline: str


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    pipeline = "ready" if getattr(app.state, "chat_token", None) else "unavailable"
    return HealthResponse(status="ok", pipeline=pipeline)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    token: str | None = getattr(app.state, "chat_token", None)
    if not token:
        raise HTTPException(status_code=503, detail="coding-agent pipeline not available")
    try:
        reply = await send_text(token, request.message)
    except Exception as exc:
        logger.exception("send_text failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ChatResponse(reply=reply)


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
                    reply = await send_audio(token, bytes(buffer))
                    await websocket.send_json({"type": "reply", "text": reply})
                except Exception as exc:
                    logger.exception("send_audio failed")
                    await websocket.send_json({"type": "error", "message": str(exc)})
                buffer.clear()
    except WebSocketDisconnect:
        return

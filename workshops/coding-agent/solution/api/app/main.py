import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.libs.rocketride import send_message  # noqa: F401  re-wired in next step

app = FastAPI(title="coding-agent solution")


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    # TODO: wire to send_message(app.state.chat_token, request.message)
    # once coding-agent.pipe has real components.
    return ChatResponse(reply=f"stub: {request.message}")


@app.websocket("/api/ws/chat")
async def chat_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    audio_bytes = 0
    try:
        while True:
            message = await websocket.receive()
            data_bytes = message.get("bytes")
            if data_bytes is not None:
                audio_bytes += len(data_bytes)
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
                audio_bytes = 0
            elif event_type == "end":
                # TODO: forward audio buffer to RocketRide pipeline via
                # app.libs.rocketride once audio_transcribe node is wired.
                await websocket.send_json(
                    {"type": "reply", "text": f"stub: heard {audio_bytes} bytes of audio"}
                )
                audio_bytes = 0
    except WebSocketDisconnect:
        return

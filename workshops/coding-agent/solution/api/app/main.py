from fastapi import FastAPI
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

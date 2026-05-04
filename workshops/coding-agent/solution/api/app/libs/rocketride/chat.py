"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from rocketride.schema import Question

from app.libs.rocketride.client import get_client

PIPELINE_PATH = Path(__file__).resolve().parents[2] / "pipelines" / "coding-agent.pipe"


async def start_coding_agent() -> str:
    client = await get_client()
    result = cast(dict[str, Any], await client.use(filepath=str(PIPELINE_PATH)))
    return cast(str, result["token"])


async def send_message(token: str, text: str) -> str:
    client = await get_client()
    question = Question()  # type: ignore[call-arg]
    question.addQuestion(text)
    response = cast(dict[str, Any], await client.chat(token=token, question=question))
    answers = response.get("answers") or []
    if not answers:
        return ""
    return cast(str, answers[0])

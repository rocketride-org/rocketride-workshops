"""Pipeline lifecycle and chat helpers for the coding-agent pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

from app.libs.rocketride.client import get_client

PIPELINE_PATH = Path(__file__).resolve().parents[2] / "pipelines" / "coding-agent.pipe"


async def start_coding_agent() -> str:
    client = await get_client()
    result = cast(dict[str, Any], await client.use(filepath=str(PIPELINE_PATH)))
    return cast(str, result["token"])


async def send_text(token: str, text: str) -> str:
    client = await get_client()
    result = cast(
        dict[str, Any],
        await client.send(token=token, data=text, mimetype="text/plain"),
    )
    return _first_answer(result)


async def send_audio(
    token: str,
    data: bytes,
    mimetype: str = "audio/webm;codecs=opus",
) -> str:
    client = await get_client()
    result = cast(
        dict[str, Any],
        await client.send(token=token, data=data, mimetype=mimetype),
    )
    return _first_answer(result)


def _first_answer(result: dict[str, Any]) -> str:
    answers = result.get("answers") or []
    if not answers:
        return ""
    first = answers[0]
    if isinstance(first, str):
        return first
    return str(first)

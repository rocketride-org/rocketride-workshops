"""Internal wrapper around the RocketRide Python SDK.

Routes import from `app.libs.rocketride` rather than touching the SDK
directly, so client lifecycle and chat helpers live in one place.
"""

from app.libs.rocketride.chat import send_audio, send_text, start_coding_agent
from app.libs.rocketride.client import disconnect, get_client

__all__ = [
    "disconnect",
    "get_client",
    "send_audio",
    "send_text",
    "start_coding_agent",
]

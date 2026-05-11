"""Internal wrapper around the RocketRide Python SDK.

Routes import from `app.libs.rocketride` rather than touching the SDK
directly, so client lifecycle and chat helpers live in one place.
"""

from app.libs.rocketride.chat import (
    record_runtime_event,
    send_blob,
    send_blob_with_text,
    send_text,
    start_coding_agent,
)
from app.libs.rocketride.client import (
    connect_with_retry,
    disconnect,
    get_client,
    reset_client,
    set_event_handler,
)

__all__ = [
    "connect_with_retry",
    "disconnect",
    "get_client",
    "record_runtime_event",
    "reset_client",
    "send_blob",
    "send_blob_with_text",
    "send_text",
    "set_event_handler",
    "start_coding_agent",
]

"""Singleton wrapper around the RocketRide SDK client.

Two responsibilities:

1. Lazy-connect on first use, then cache the client so every helper in
   the project shares one connection.
2. Forward every engine runtime event to a single registered handler
   (the API layer's tracer + console logger in `main.py`).

`ROCKETRIDE_URI` and `ROCKETRIDE_APIKEY` are picked up from `.env`
automatically; callers don't pass them.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from collections.abc import Awaitable, Callable
from typing import Any

from rocketride import RocketRideClient

logger = logging.getLogger("coding-agent")

DEFAULT_CONNECT_TIMEOUT = 60.0

_cached_client: RocketRideClient | None = None

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]
_event_handler: EventHandler | None = None


def set_event_handler(handler: EventHandler | None) -> None:
    """Register the async callback that receives every engine runtime event."""
    global _event_handler
    _event_handler = handler


async def dispatch_event_to_handler(message: dict[str, Any]) -> None:
    """Spawn the registered handler in its own task. Errors get logged, never raised."""
    handler = _event_handler
    if handler is None:
        return

    async def _run() -> None:
        try:
            await handler(message)
        except Exception:
            logger.exception("runtime event handler raised")

    asyncio.create_task(_run())


# The shipped SDK (1.0.6) puts the task token at the top of `execute`
# requests, but the local server build expects it inside `arguments.token`.
# Mirror it into both spots so old + new servers stay happy.
def patch_build_request_to_mirror_token() -> None:
    original = RocketRideClient.build_request

    def patched(self: RocketRideClient, command: str, **kwargs: Any) -> dict[str, Any]:
        request = original(self, command, **kwargs)
        token = kwargs.get("token")
        if token is not None:
            args = request.setdefault("arguments", {})
            args.setdefault("token", token)
        return request

    RocketRideClient.build_request = patched  # type: ignore[assignment]


patch_build_request_to_mirror_token()


async def get_client() -> RocketRideClient:
    """Return the shared client, connecting it the first time it's asked for."""
    global _cached_client
    if _cached_client is None:
        _cached_client = RocketRideClient(on_event=dispatch_event_to_handler)
        await _cached_client.connect()
    return _cached_client


async def connect_with_retry(
    timeout: float | None = None,
    interval: float = 1.0,
) -> RocketRideClient:
    """Wait for the runtime to come up, then connect.

    `pnpm dev` boots api and runtime in parallel; the api lifespan
    usually wins the race and hits a connection-refused. Retry every
    `interval` seconds until the runtime listens or `timeout` elapses.
    Override the default with `ROCKETRIDE_CONNECT_TIMEOUT` (seconds) —
    CI sets this low so the api yields quickly when no runtime is
    expected.
    """
    global _cached_client
    if timeout is None:
        env_timeout = os.environ.get("ROCKETRIDE_CONNECT_TIMEOUT")
        timeout = float(env_timeout) if env_timeout else DEFAULT_CONNECT_TIMEOUT
    deadline = asyncio.get_event_loop().time() + timeout
    warned = False
    last_error: Exception | None = None
    while True:
        try:
            return await get_client()
        except (ConnectionError, OSError) as exc:
            last_error = exc
            if not warned:
                logger.info("waiting for runtime to accept connections...")
                warned = True
            if _cached_client is not None:
                with contextlib.suppress(Exception):
                    await _cached_client.disconnect()
                _cached_client = None
            if asyncio.get_event_loop().time() >= deadline:
                raise
            await asyncio.sleep(interval)
            assert last_error is not None  # for mypy


async def disconnect() -> None:
    """Close the cached client (if any) and clear the slot."""
    global _cached_client
    if _cached_client is not None:
        await _cached_client.disconnect()
        _cached_client = None


async def reset_client() -> None:
    """Drop the cached client without raising — used during recovery.

    The engine WS may have already died, in which case `disconnect` itself
    can raise. We swallow the failure so callers can immediately call
    `get_client()` to rebuild from scratch.
    """
    global _cached_client
    if _cached_client is None:
        return
    with contextlib.suppress(Exception):
        await _cached_client.disconnect()
    _cached_client = None

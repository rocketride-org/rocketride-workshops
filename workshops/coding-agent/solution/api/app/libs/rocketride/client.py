"""Lazy singleton wrapper around `RocketRideClient`.

The SDK reads `ROCKETRIDE_URI` and `ROCKETRIDE_APIKEY` from `.env`
automatically, so callers don't pass anything.

`build_request` is patched to mirror `token` into `arguments` — the
shipped SDK (1.0.6) places the task token at the request top level,
but the local server build reads it from `arguments.token`. Mirroring
keeps both old and new servers happy.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from rocketride import RocketRideClient

logger = logging.getLogger("coding-agent")

_client: RocketRideClient | None = None

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]
_on_event_handler: EventHandler | None = None


def set_event_handler(handler: EventHandler | None) -> None:
    """Register an async callback that receives every runtime event."""
    global _on_event_handler
    _on_event_handler = handler


async def _dispatch(message: dict[str, Any]) -> None:
    handler = _on_event_handler
    if handler is None:
        return

    async def _run() -> None:
        try:
            await handler(message)
        except Exception:
            logger.exception("runtime event handler raised")

    asyncio.create_task(_run())


def _patch_build_request() -> None:
    original = RocketRideClient.build_request

    def patched(self: RocketRideClient, command: str, **kwargs: Any) -> dict[str, Any]:
        request = original(self, command, **kwargs)
        token = kwargs.get("token")
        if token is not None:
            args = request.setdefault("arguments", {})
            args.setdefault("token", token)
        return request

    RocketRideClient.build_request = patched  # type: ignore[assignment]


_patch_build_request()


async def get_client() -> RocketRideClient:
    global _client
    if _client is None:
        _client = RocketRideClient(on_event=_dispatch)
        await _client.connect()
    return _client


async def connect_with_retry(
    timeout: float = 60.0,
    interval: float = 1.0,
) -> RocketRideClient:
    """Wait for the runtime to come up, then connect.

    `pnpm dev` boots api and runtime in parallel; the api lifespan
    usually wins the race and hits a connection-refused. Retry every
    `interval` seconds until the runtime listens or `timeout` elapses.
    """
    global _client
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
            if _client is not None:
                with contextlib.suppress(Exception):
                    await _client.disconnect()
                _client = None
            if asyncio.get_event_loop().time() >= deadline:
                raise
            await asyncio.sleep(interval)
            assert last_error is not None  # for mypy


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None

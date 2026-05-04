"""Lazy singleton wrapper around `RocketRideClient`.

The SDK reads `ROCKETRIDE_URI` and `ROCKETRIDE_APIKEY` from `.env`
automatically, so callers don't pass anything.
"""

from __future__ import annotations

from rocketride import RocketRideClient

_client: RocketRideClient | None = None


async def get_client() -> RocketRideClient:
    global _client
    if _client is None:
        _client = RocketRideClient()
        await _client.connect()
    return _client


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.disconnect()
        _client = None

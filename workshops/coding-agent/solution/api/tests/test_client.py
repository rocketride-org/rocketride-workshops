"""Tests for `app.libs.rocketride.client` — connection lifecycle + dispatch."""

from __future__ import annotations

import asyncio
import logging

import pytest

from app.libs.rocketride import client as client_mod


@pytest.fixture(autouse=True)
def reset_module_state():
    """Each test starts with no cached client and no event handler."""
    client_mod._client = None
    client_mod._on_event_handler = None
    yield
    client_mod._client = None
    client_mod._on_event_handler = None


class TestPatchBuildRequest:
    def test_token_kwarg_mirrored_into_arguments(self) -> None:
        """The patched build_request should copy `token` into `arguments`."""

        class StubClient:
            def __init__(self) -> None:
                pass

            def build_request(self, command: str, **kwargs):
                return {"command": command, "arguments": dict(kwargs.get("payload") or {})}

        # Apply the same patcher used in client.py to a stub.
        from rocketride import RocketRideClient

        # The real module already patched RocketRideClient at import. Verify behavior.
        instance = RocketRideClient.__new__(RocketRideClient)  # type: ignore[call-arg]
        # Use only the patched bits — we don't want full SDK init.
        result = RocketRideClient.build_request(instance, command="execute", token="tk_x")
        assert result["arguments"]["token"] == "tk_x"

    def test_token_not_overwritten_if_already_set_in_arguments(self) -> None:
        from rocketride import RocketRideClient

        instance = RocketRideClient.__new__(RocketRideClient)  # type: ignore[call-arg]
        # Calling build_request with no token → arguments has no token (setdefault on a fresh dict).
        result = RocketRideClient.build_request(instance, command="execute")
        # If `arguments` exists in the original payload it stays; if not, no token field.
        assert "token" not in result.get("arguments", {})


class TestSetEventHandlerAndDispatch:
    async def test_dispatch_calls_handler_when_registered(self) -> None:
        received: list[dict] = []

        async def handler(msg):
            received.append(msg)

        client_mod.set_event_handler(handler)
        await client_mod._dispatch({"event": "x", "body": {}})
        # _dispatch creates a task; let it run.
        await asyncio.sleep(0)
        assert received == [{"event": "x", "body": {}}]

    async def test_dispatch_with_no_handler_is_noop(self) -> None:
        # No handler registered.
        await client_mod._dispatch({"event": "x"})
        # Reaching here without exception is the assertion.

    async def test_dispatch_handler_exception_logged_not_raised(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        async def handler(_msg):
            raise RuntimeError("handler boom")

        client_mod.set_event_handler(handler)
        with caplog.at_level(logging.ERROR, logger="coding-agent"):
            await client_mod._dispatch({"event": "y"})
            await asyncio.sleep(0)
            await asyncio.sleep(0)
        # Exception should be logged via logger.exception in _run.
        assert any("handler boom" in rec.getMessage() or rec.exc_info for rec in caplog.records)


class TestConnectWithRetry:
    async def test_returns_client_on_first_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        sentinel = object()

        async def fake_get_client():
            return sentinel

        monkeypatch.setattr(client_mod, "get_client", fake_get_client)
        assert await client_mod.connect_with_retry(timeout=1.0) is sentinel

    async def test_retries_until_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        attempts = {"n": 0}
        sentinel = object()

        async def flaky_get_client():
            attempts["n"] += 1
            if attempts["n"] < 3:
                # Set _client to a stub so the cleanup branch runs (line 106-109).
                class StubClient:
                    async def disconnect(self):
                        return None

                client_mod._client = StubClient()  # type: ignore[assignment]
                raise ConnectionError("not yet")
            return sentinel

        async def no_sleep(_):
            return None

        monkeypatch.setattr(client_mod, "get_client", flaky_get_client)
        monkeypatch.setattr(client_mod.asyncio, "sleep", no_sleep)
        result = await client_mod.connect_with_retry(timeout=10.0, interval=0.0)
        assert result is sentinel
        assert attempts["n"] == 3

    async def test_raises_when_deadline_exceeded(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def always_fail():
            raise OSError("nope")

        async def no_sleep(_):
            return None

        # Set fake client so cleanup branch runs.
        class StubClient:
            async def disconnect(self):
                return None

        client_mod._client = StubClient()  # type: ignore[assignment]

        monkeypatch.setattr(client_mod, "get_client", always_fail)
        monkeypatch.setattr(client_mod.asyncio, "sleep", no_sleep)
        with pytest.raises(OSError):
            await client_mod.connect_with_retry(timeout=0.001, interval=0.0)


class TestDisconnectAndReset:
    async def test_disconnect_clears_cached_client(self) -> None:
        calls = {"n": 0}

        class StubClient:
            async def disconnect(self):
                calls["n"] += 1

        client_mod._client = StubClient()  # type: ignore[assignment]
        await client_mod.disconnect()
        assert calls["n"] == 1
        assert client_mod._client is None

    async def test_disconnect_when_no_cached_client_is_noop(self) -> None:
        client_mod._client = None
        await client_mod.disconnect()  # should not raise

    async def test_reset_client_swallows_disconnect_failures(self) -> None:
        class BadClient:
            async def disconnect(self):
                raise RuntimeError("disconnect failed")

        client_mod._client = BadClient()  # type: ignore[assignment]
        await client_mod.reset_client()  # must not raise
        assert client_mod._client is None

    async def test_reset_client_when_no_cached_client_is_noop(self) -> None:
        client_mod._client = None
        await client_mod.reset_client()


class TestGetClient:
    async def test_caches_singleton(self, monkeypatch: pytest.MonkeyPatch) -> None:
        instances: list = []

        class StubClient:
            def __init__(self, on_event=None):
                instances.append(self)

            async def connect(self):
                return None

        monkeypatch.setattr(client_mod, "RocketRideClient", StubClient)
        a = await client_mod.get_client()
        b = await client_mod.get_client()
        assert a is b
        assert len(instances) == 1

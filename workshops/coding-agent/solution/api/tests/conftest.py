"""Shared fixtures.

Tests run against a `FakeClient` injected at the import binding
`app.libs.rocketride.chat.get_client` (and `app.main.start_coding_agent` /
`connect_with_retry` for WS tests). The real RocketRide SDK is never invoked.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest


class FakeClient:
    """Stand-in for `rocketride.RocketRideClient`.

    Records every SDK call for assertion. Each method's return value can be
    overridden per-test by setting the corresponding attribute. Callers may
    also set `*_side_effect` to a callable or exception that runs/raises in
    place of the canned return.
    """

    def __init__(self) -> None:
        self.use_calls: list[dict[str, Any]] = []
        self.set_events_calls: list[tuple[str, list[str]]] = []
        self.chat_calls: list[dict[str, Any]] = []
        self.send_calls: list[dict[str, Any]] = []
        self.send_files_calls: list[dict[str, Any]] = []
        self.disconnect_calls = 0

        # Default canned returns
        self.use_response: Callable[[str], dict[str, Any]] = lambda src: {"token": f"tk_{src}"}
        self.set_events_side_effect: Exception | None = None
        self.chat_response: dict[str, Any] = {"answers": ["chat-ok"]}
        self.chat_side_effect: Exception | None = None
        self.chat_sse_events: list[tuple[str, dict[str, Any]]] = []
        self.send_response: dict[str, Any] = {"answers": ["blob-ok"]}
        self.send_side_effect: Exception | None = None
        self.send_sse_events: list[tuple[str, dict[str, Any]]] = []
        self.send_files_response: list[dict[str, Any]] = [{"answers": ["files-ok"]}]
        self.send_files_side_effect: Exception | None = None

    async def use(
        self,
        *,
        filepath: str,
        source: str | None = None,
        pipelineTraceLevel: str | None = None,
        ttl: int | None = None,
    ) -> dict[str, Any]:
        self.use_calls.append(
            {
                "filepath": filepath,
                "source": source,
                "pipelineTraceLevel": pipelineTraceLevel,
                "ttl": ttl,
            }
        )
        return self.use_response(source or "")

    async def set_events(self, token: str, types: list[str]) -> None:
        self.set_events_calls.append((token, types))
        if self.set_events_side_effect is not None:
            raise self.set_events_side_effect

    async def chat(
        self,
        *,
        token: str,
        question: Any,
        on_sse: Any = None,
    ) -> dict[str, Any]:
        self.chat_calls.append({"token": token, "question": question, "on_sse": on_sse})
        if on_sse is not None:
            for event_type, body in self.chat_sse_events:
                await on_sse(event_type, body)
        if self.chat_side_effect is not None:
            raise self.chat_side_effect
        return self.chat_response

    async def send(
        self,
        token: str | None = None,
        data: Any = None,
        objinfo: dict[str, Any] | None = None,
        mimetype: str | None = None,
        on_sse: Any = None,
    ) -> dict[str, Any]:
        self.send_calls.append(
            {
                "token": token,
                "data": data,
                "mimetype": mimetype,
                "objinfo": objinfo,
                "on_sse": on_sse,
            }
        )
        if on_sse is not None:
            for event_type, body in self.send_sse_events:
                await on_sse(event_type, body)
        if self.send_side_effect is not None:
            raise self.send_side_effect
        return self.send_response

    async def send_files(self, files: list[Any], token: str) -> list[dict[str, Any]]:
        self.send_files_calls.append({"files": list(files), "token": token})
        if self.send_files_side_effect is not None:
            raise self.send_files_side_effect
        return self.send_files_response

    async def disconnect(self) -> None:
        self.disconnect_calls += 1


@pytest.fixture
def fake_client(monkeypatch: pytest.MonkeyPatch) -> FakeClient:
    """Patch `chat.get_client` to always return the same FakeClient."""
    from app.libs.rocketride import chat as chat_mod

    fake = FakeClient()

    async def _get() -> FakeClient:
        return fake

    monkeypatch.setattr(chat_mod, "get_client", _get)
    return fake


@pytest.fixture
def tracer_log_dir(tmp_path, monkeypatch: pytest.MonkeyPatch):
    """Redirect `write_turn_trace` writes to a tmp_path so tests don't pollute logs/."""
    from app.libs.rocketride import chat as chat_mod

    monkeypatch.setattr(chat_mod, "LOG_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def fastapi_app(monkeypatch: pytest.MonkeyPatch, fake_client: FakeClient):
    """Build a FastAPI app with pipeline-init + connect mocked so lifespan
    completes instantly without touching a real engine. Returns (app, fake_client).
    """
    from app import main as main_mod

    async def _connect_ok() -> None:
        return None

    async def _start_ok() -> str:
        return "tk_webhook"

    async def _disconnect_ok() -> None:
        return None

    monkeypatch.setattr(main_mod, "connect_with_retry", _connect_ok)
    monkeypatch.setattr(main_mod, "start_coding_agent", _start_ok)
    monkeypatch.setattr(main_mod, "disconnect", _disconnect_ok)
    return main_mod.app, fake_client

"""Lifecycle + runtime-event tests for `app.main`."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app import main as main_mod


class TestHealthEndpoint:
    @pytest.fixture(autouse=True)
    def _reset_component_cache(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Force a fresh pipe-count read for every test in this class so
        # one test's monkeypatch doesn't leak through the module-level cache.
        monkeypatch.setattr(main_mod, "_pipe_component_count", None)

    def test_unbuilt_with_empty_starter_pipe(self) -> None:
        # The exercise ships with an empty pipe (components: []). The
        # default health response should report "unbuilt" so the UI locks
        # its inputs until the participant builds the pipeline.
        with TestClient(main_mod.app) as tc:
            resp = tc.get("/api/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok", "pipeline": "unbuilt", "components": 0}

    def test_unavailable_until_pipelines_initialized(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Pretend the pipe is populated so we exercise the unavailable
        # branch — the empty starter pipe would short-circuit to "unbuilt".
        monkeypatch.setattr(main_mod, "pipe_component_count", lambda: 38)

        async def slow_start() -> str:
            await asyncio.sleep(10)
            return ""

        async def conn_ok() -> None:
            return None

        async def disc_ok() -> None:
            return None

        monkeypatch.setattr(main_mod, "connect_with_retry", conn_ok)
        monkeypatch.setattr(main_mod, "start_coding_agent", slow_start)
        monkeypatch.setattr(main_mod, "disconnect", disc_ok)
        with TestClient(main_mod.app) as tc:
            resp = tc.get("/api/health")
            assert resp.status_code == 200
            body = resp.json()
            assert body["status"] == "ok"
            assert body["pipeline"] == "unavailable"
            assert body["components"] == 38

    def test_ready_after_init(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(main_mod, "pipe_component_count", lambda: 38)

        async def conn_ok() -> None:
            return None

        async def start_ok() -> str:
            return "tk_webhook"

        async def disc_ok() -> None:
            return None

        monkeypatch.setattr(main_mod, "connect_with_retry", conn_ok)
        monkeypatch.setattr(main_mod, "start_coding_agent", start_ok)
        monkeypatch.setattr(main_mod, "disconnect", disc_ok)
        with TestClient(main_mod.app) as tc:
            # Give the init task a moment to finish.
            for _ in range(20):
                if tc.get("/api/health").json()["pipeline"] == "ready":
                    break
                import time

                time.sleep(0.05)
            body = tc.get("/api/health").json()
            assert body["status"] == "ok"
            assert body["pipeline"] == "ready"
            assert body["components"] == 38


class TestRuntimeEventDispatch:
    """`runtime_logger` has propagate=False with a console-attached
    StreamHandler, so caplog (which hooks the root logger) misses it. Spy on
    `runtime_logger.info` directly to assert formatter dispatch."""

    @pytest.fixture
    def info_spy(self, monkeypatch: pytest.MonkeyPatch):
        calls: list[tuple] = []

        def spy(*args, **kwargs):
            calls.append((args, kwargs))

        monkeypatch.setattr(main_mod.runtime_logger, "info", spy)
        return calls

    async def test_formatter_invoked_for_node_started(self, info_spy) -> None:
        await main_mod.handle_runtime_event(
            {
                "event": "apaevt_node_started",
                "seq": 1,
                "body": {"name": "Engineer 1", "status": "running"},
            }
        )
        rendered = "\n".join(args[0] % args[1:] for args, _ in info_spy)
        assert "Engineer 1" in rendered
        assert "running" in rendered

    async def test_status_update_dropped_from_tracer_and_console(
        self,
        monkeypatch: pytest.MonkeyPatch,
        info_spy,
    ) -> None:
        recorded: list = []

        def fake_record(*args):
            recorded.append(args)

        monkeypatch.setattr(main_mod, "record_runtime_event", fake_record)
        await main_mod.handle_runtime_event(
            {"event": "apaevt_status_update", "seq": 2, "body": {"cpu": 1}}
        )
        # Dropped from both: no tracer record, no console log.
        assert recorded == []
        assert info_spy == []

    async def test_unknown_event_uses_fallback_formatter(self, info_spy) -> None:
        await main_mod.handle_runtime_event(
            {"event": "apaevt_custom", "seq": 99, "body": {"k": "v"}}
        )
        rendered = "\n".join(args[0] % args[1:] for args, _ in info_spy)
        assert "seq=99" in rendered
        assert "apaevt_custom" in rendered

    async def test_node_error_formatter(self, info_spy) -> None:
        await main_mod.handle_runtime_event(
            {
                "event": "apaevt_node_error",
                "seq": 5,
                "body": {"name": "Bad Node", "error": "something failed"},
            }
        )
        rendered = "\n".join(args[0] % args[1:] for args, _ in info_spy)
        assert "Bad Node" in rendered
        assert "something failed" in rendered

    async def test_flow_event_recorded_to_tracer_but_suppressed_in_console(
        self, monkeypatch: pytest.MonkeyPatch, info_spy
    ) -> None:
        recorded: list = []

        def fake_record(*args):
            recorded.append(args)

        monkeypatch.setattr(main_mod, "record_runtime_event", fake_record)
        await main_mod.handle_runtime_event(
            {"event": "apaevt_flow", "seq": 7, "body": {"data": "x"}}
        )
        # EVENTS_HIDDEN_FROM_CONSOLE only contains the heartbeat event, so
        # flow surfaces in the console. Tracer always gets it (not in
        # EVENTS_NEVER_LOGGED either).
        assert len(recorded) == 1
        assert info_spy  # console got it too


class TestInitPipelineRetry:
    async def test_retries_on_failure_then_succeeds(self, monkeypatch: pytest.MonkeyPatch) -> None:
        attempts = {"n": 0}

        async def flaky_connect() -> None:
            attempts["n"] += 1
            if attempts["n"] < 2:
                raise RuntimeError("engine not up yet")

        async def start_ok() -> str:
            return "tk_webhook_x"

        async def no_sleep(_):
            return None

        monkeypatch.setattr(main_mod, "connect_with_retry", flaky_connect)
        monkeypatch.setattr(main_mod, "start_coding_agent", start_ok)
        monkeypatch.setattr(main_mod.asyncio, "sleep", no_sleep)

        # Reset state so this test owns the init.
        main_mod.app.state.coding_token = None
        main_mod.app.state.coding_ready = asyncio.Event()
        await main_mod.start_pipelines_with_retry(main_mod.app)
        assert attempts["n"] == 2
        assert main_mod.app.state.coding_token == "tk_webhook_x"
        assert main_mod.app.state.coding_ready.is_set()


class TestRecoverPipeline:
    async def test_returns_cached_token_when_already_recovered(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        existing = "tk_existing"
        main_mod.app.state.coding_token = existing
        main_mod.app.state._coding_recovering_from = None  # type: ignore[attr-defined]

        async def must_not_run() -> str:
            raise AssertionError("start_coding_agent should not be called")

        monkeypatch.setattr(main_mod, "start_coding_agent", must_not_run)
        result = await main_mod.restart_pipelines_after_drop()
        assert result == existing

    async def test_restarts_when_no_existing_token(self, monkeypatch: pytest.MonkeyPatch) -> None:
        main_mod.app.state.coding_token = None
        main_mod.app.state._coding_recovering_from = None  # type: ignore[attr-defined]

        async def reset_ok() -> None:
            return None

        async def conn_ok() -> None:
            return None

        async def start_ok() -> str:
            return "tk_new"

        monkeypatch.setattr(main_mod, "reset_client", reset_ok)
        monkeypatch.setattr(main_mod, "connect_with_retry", conn_ok)
        monkeypatch.setattr(main_mod, "start_coding_agent", start_ok)

        result = await main_mod.restart_pipelines_after_drop()
        assert result == "tk_new"
        assert main_mod.app.state.coding_token == "tk_new"

    async def test_returns_none_when_restart_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        main_mod.app.state.coding_token = None
        main_mod.app.state._coding_recovering_from = None  # type: ignore[attr-defined]

        async def reset_ok() -> None:
            return None

        async def conn_ok() -> None:
            return None

        async def start_fail() -> str:
            raise RuntimeError("recovery exploded")

        monkeypatch.setattr(main_mod, "reset_client", reset_ok)
        monkeypatch.setattr(main_mod, "connect_with_retry", conn_ok)
        monkeypatch.setattr(main_mod, "start_coding_agent", start_fail)

        result = await main_mod.restart_pipelines_after_drop()
        assert result is None

"""Tests for `write_turn_trace` — append-only JSON-per-run file under LOG_DIR."""
# (renamed from `_dump_tracer`; behavior unchanged)

from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import pytest

from app.libs.rocketride.chat import write_turn_trace


def test_writes_dated_log_file(tracer_log_dir: Path) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    write_turn_trace(started, "hello", [], [], {"answers": ["ok"]}, error=None)
    files = list(tracer_log_dir.glob("*_tracer.log"))
    assert len(files) == 1
    assert files[0].name == "2026-05-08_tracer.log"


def test_payload_contains_prompt_result_and_no_error(tracer_log_dir: Path) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    write_turn_trace(
        started,
        "the prompt",
        [{"type": "thinking", "body": {"message": "tool"}}],
        [{"event": "apaevt_node_started", "seq": 1, "body": {"name": "X"}}],
        {"answers": ["the answer"]},
        error=None,
    )
    raw = (tracer_log_dir / "2026-05-08_tracer.log").read_text(encoding="utf-8")
    # Strip the "===== run start ... =====" markers to get the JSON payload.
    body = re.sub(r"=====[^\n]+=====\n", "", raw).strip()
    payload = json.loads(body)
    assert payload["prompt"] == "the prompt"
    assert payload["result"] == {"answers": ["the answer"]}
    assert payload["error"] is None
    assert payload["sse_events"][0]["body"]["message"] == "tool"
    assert payload["runtime_events"][0]["event"] == "apaevt_node_started"


def test_error_field_serialized_as_repr(tracer_log_dir: Path) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    write_turn_trace(started, "p", [], [], None, error=RuntimeError("boom"))
    raw = (tracer_log_dir / "2026-05-08_tracer.log").read_text(encoding="utf-8")
    body = re.sub(r"=====[^\n]+=====\n", "", raw).strip()
    payload = json.loads(body)
    assert payload["error"] == "RuntimeError('boom')"
    assert payload["result"] is None


def test_appends_across_multiple_calls(tracer_log_dir: Path) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    write_turn_trace(started, "first", [], [], {"answers": ["a"]}, error=None)
    write_turn_trace(started, "second", [], [], {"answers": ["b"]}, error=None)
    raw = (tracer_log_dir / "2026-05-08_tracer.log").read_text(encoding="utf-8")
    assert raw.count("===== run start") == 2
    assert "first" in raw
    assert "second" in raw


def test_supports_list_result_from_send_files(tracer_log_dir: Path) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    write_turn_trace(started, "p", [], [], [{"answers": ["x"]}, {"answers": ["y"]}], error=None)
    raw = (tracer_log_dir / "2026-05-08_tracer.log").read_text(encoding="utf-8")
    body = re.sub(r"=====[^\n]+=====\n", "", raw).strip()
    payload = json.loads(body)
    assert isinstance(payload["result"], list)
    assert len(payload["result"]) == 2


def test_io_failure_does_not_raise(tracer_log_dir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    started = datetime(2026, 5, 8, 12, 0, 0)
    # Replace Path.open to raise; the broad except in write_turn_trace must swallow.
    real_open = Path.open

    def bad_open(self: Path, *args, **kwargs):  # noqa: ANN001
        if self.name.endswith("_tracer.log"):
            raise OSError("disk full")
        return real_open(self, *args, **kwargs)

    monkeypatch.setattr(Path, "open", bad_open)
    # Should not propagate.
    write_turn_trace(started, "p", [], [], None, error=None)

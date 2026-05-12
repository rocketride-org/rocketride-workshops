"""Tests for `SecretScrubFilter` — env-var snapshot + regex-based redaction."""

from __future__ import annotations

import logging

import pytest


@pytest.fixture
def fresh_filter(monkeypatch: pytest.MonkeyPatch):
    """Reload main with deterministic env so the snapshot is predictable."""
    monkeypatch.setenv("ROCKETRIDE_APIKEY", "supersecretvalue")
    monkeypatch.setenv("ROCKETRIDE_ANTHROPIC_KEY", "anthropic-real-key-1234")
    # Re-instantiate with the patched env in scope.
    from app.main import SecretScrubFilter

    return SecretScrubFilter()


def _record(message: str) -> logging.LogRecord:
    return logging.LogRecord(
        name="t",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=None,
    )


def test_replaces_env_var_secret_in_message(fresh_filter) -> None:
    rec = _record("config loaded: supersecretvalue")
    assert fresh_filter.filter(rec) is True
    assert rec.getMessage() == "config loaded: ***REDACTED***"


def test_replaces_pk_token_pattern(fresh_filter) -> None:
    rec = _record("starting pipeline pk_AAAAAAAAAAAAAAAA1234")
    fresh_filter.filter(rec)
    assert "pk_AAAAA" not in rec.getMessage()
    assert "***REDACTED***" in rec.getMessage()


def test_replaces_tk_token_pattern(fresh_filter) -> None:
    rec = _record("token=tk_BBBBBBBBBBBBBBBB5678 active")
    fresh_filter.filter(rec)
    assert "tk_BBBB" not in rec.getMessage()


def test_replaces_anthropic_sk_pattern(fresh_filter) -> None:
    rec = _record("auth sk-ant-AAAAABBBBBCCCCCDDDDDeeeeefffff sent")
    fresh_filter.filter(rec)
    assert "sk-ant-" not in rec.getMessage()


def test_message_without_secret_passes_unchanged(fresh_filter) -> None:
    rec = _record("nothing sensitive here")
    fresh_filter.filter(rec)
    assert rec.getMessage() == "nothing sensitive here"


def test_short_env_secret_below_min_length_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ROCKETRIDE_APIKEY", "abc")  # below _MIN_LENGTH=4
    monkeypatch.delenv("ROCKETRIDE_ANTHROPIC_KEY", raising=False)
    from app.main import SecretScrubFilter

    f = SecretScrubFilter()
    rec = _record("contains abc here")
    f.filter(rec)
    # Short value not snapshotted; message untouched.
    assert "abc" in rec.getMessage()


def test_filter_returns_true_even_when_getmessage_raises(fresh_filter) -> None:
    rec = _record("doesn't matter")
    # Force getMessage to raise.
    rec.args = ("missing",)
    rec.msg = "%(missing)s %d"  # malformed format
    assert fresh_filter.filter(rec) is True

"""Trivial pipeline definition used by the solution to prove end-to-end wiring.

In a real workshop project this file would describe a Rocketride pipeline that
the runtime loads and executes (file ingestion, LLM calls, vector store
queries, etc.). For the scaffolding we just expose a constant that the SDK
client returns when it cannot reach the runtime, so the UI has something to
render until the runtime contract is wired up.
"""

HELLO_MESSAGE = "hello from rocketride"


def hello_pipeline() -> str:
    return HELLO_MESSAGE

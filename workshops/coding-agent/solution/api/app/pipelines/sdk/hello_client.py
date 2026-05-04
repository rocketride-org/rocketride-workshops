"""Rocketride SDK integration for the `hello` pipeline.

The real workshop content (separate session) will replace this with a call
into the Rocketride Python client to start and read results from a pipeline
running on the local runtime. For now the wiring is proved end-to-end by
returning the pipeline's local definition so the UI displays the same string
the pipeline would return.
"""

from app.pipelines.definitions.hello import hello_pipeline


async def run_hello() -> str:
    return hello_pipeline()

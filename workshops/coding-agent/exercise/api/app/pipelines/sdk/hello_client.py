"""Rocketride SDK integration — TODO for the workshop.

Goal: implement `run_hello()` so that it talks to the locally running
Rocketride runtime via the Python SDK and returns the result of the
`hello` pipeline you defined in `../definitions/hello.py`.

Hints:
- The runtime is started for you by `runtime/` (`launchpad start`).
- The Rocketride Python SDK is shipped inside the runtime tarball at
  `<project>/.dependencies/rocketride/rocketride/` (you can also pip-install
  the corresponding release artifact — see workshop notes).
- Compare against `solution/api/app/pipelines/sdk/hello_client.py` if you
  get stuck.
"""


async def run_hello() -> str:
    raise NotImplementedError(
        "Implement run_hello() to call into the Rocketride runtime via the SDK.",
    )

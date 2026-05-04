# coding-agent — Exercise

Scaffolded workshop project. Your job is to fill in the empty pieces so the UI displays a real result from a Rocketride pipeline.

## Quickstart

```sh
pnpm install              # at repo root
cd workshops/coding-agent/exercise
pnpm dev
```

Open http://localhost:5173. Until you wire things up, the page will show an error because `/api/hello` is not implemented yet.

## What's already wired

- `ui/` — Vite + React + TS front-end. Hits `/api/hello` and renders the response. **Don't change this.**
- `runtime/` — runs `launchpad start` to boot the Rocketride engine. **Don't change this.**
- `api/app/main.py` — FastAPI route exists but raises `NotImplementedError`. You'll wire it.

## What you'll build

Inside `api/app/pipelines/`:

1. **`definitions/hello.py`** — write a Rocketride pipeline definition.
2. **`sdk/hello_client.py`** — implement `run_hello()` so it talks to the runtime via the Rocketride Python SDK and returns the pipeline's result.
3. **`api/app/main.py`** — replace `NotImplementedError` with a call into your `run_hello()`.

When you're done, http://localhost:5173 should display the message your pipeline returns.

## Stuck?

Compare against `../solution/` — same structure, full implementation.

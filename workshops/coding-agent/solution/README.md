# coding-agent — Solution

Full reference implementation. Boots a UI + API + Rocketride runtime that wires a trivial hello-world pipeline end to end.

```sh
pnpm install              # at repo root
cd workshops/coding-agent/solution
pnpm dev
```

Open http://localhost:5173 — the page should display the message returned from the `hello` pipeline.

## Pieces

- `ui/` — Vite + React + TS front-end.
- `api/` — FastAPI app. Routes live in `app/main.py`. Pipeline definitions and SDK code live under `app/pipelines/`.
- `runtime/` — tiny package whose `dev` script runs `launchpad start`.
- `runtime/.rocketride/` — populated by `launchpad install` (gitignored).

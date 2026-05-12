# Workshop Inputs

Sample inputs for exercising the coding-agent pipeline during the workshop or
when smoke-testing the solution. Drop one into the UI's attach button (image)
or mic recorder (audio) and watch the agent team build the app.

Each input is a single user message — no caption, since the pipeline locks
turns to text-only OR attachment-only.

## `images/`

Diagrams the agent's vision lane interprets, then hands off to Architect →
Engineers → DevOps for implementation.

| File                  | Depicts                                              | Builds                                                       |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `hello_world_app.jpg` | Browser ↔ Node HTTP server with `GET /` + 200 arrows | A minimal Node `http` server serving an HTML "hello world".  |
| `todos_app.jpg`       | Single-page todo list UI with add/check/delete       | Static HTML/CSS/JS todo app, optionally with a JSON backend. |

## `audio/`

Voice-note prompts. Webhook source routes audio through `audio_transcribe_1`
(Whisper-class transcription) before the PM sees the request as text.

| File                         | Voice prompt summary                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `calculator_cli.m4a`         | Build a Node CLI calculator that takes two numbers and an operator on the command line. |
| `github-stars-dashboard.m4a` | Build a small dashboard that fetches a GitHub repo's star count and renders a chart.    |

## Using these in the workshop

1. Open the UI from the solution (`pnpm dev` at `workshops/coding-agent/solution`).
2. Click the attach button → pick an `images/*.jpg` OR click the mic button → use one of the audio files via a recording app.
3. Send. The agent should drive the full pipeline (bootstrap → scaffold → architect → engineers → reviewer → merge) and land a working project under `solution/.output/<slug>/`.

These inputs are also convenient for the instructor demo in Section 6 of the
lesson plan (the trace/debug section) — pick one, watch a known-good run,
and use the resulting tracer log as the discussion artifact.

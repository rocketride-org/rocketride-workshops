# Pipeline Walkthrough — `coding-agent.pipe`

The `.pipe` file is JSON managed by Studio. **Read the pipeline through
Studio's visual editor**; this doc is a printed map for participants who
want to know what the JSON declares without scrolling through 1,000+
lines of layout coordinates and system prompts.

## What the pipeline does

A user sends a request — typed text OR a single audio/image attachment
(per-message mutex: never both at once). The **Project Manager** agent
(`agent_deepagent_1`, the entry agent) reads the request and delegates
to a team of specialist subagents using the Deep Agent's built-in `task`
tool. Specialists do the actual work (design docs, code, reviews, merges,
tests). The PM never writes code itself — it decomposes, delegates, and
summarizes. The final answer comes back through `response_answers_1`.

One door opens into the pipeline: **`webhook_1`**. Every modality enters
through it:

- typed text → `mimetype=text/plain` → `webhook_1.text` lane
- image attachment → `mimetype=image/*` → `webhook_1.image` → `ocr_1` → text
- audio attachment → `mimetype=audio/*` → `webhook_1.audio` → `audio_transcribe_1` → text

`question_1` is a normalizer that takes all three text streams and emits
a single `questions` payload to the PM.

```
                       ┌─ audio ─ audio_transcribe_1 ─ text ─┐
                       │                                     │
 webhook_1 ────────────┼─ image ─ ocr_1 ──────────── text ───┼─ question_1 ── questions
                       │                                     │              │
                       └─ text ─────────────────────── text ─┘              ▼
                                                                   agent_deepagent_1
                                                                   (Project Manager)
                                                                            │
                                                                    answers │
                                                                            ▼
                                                                  response_answers_1
                                                                     (UI sees this)
```

## The team (deep-agent subagents)

The PM coordinates these specialists. Each has its own LLM, tool
whitelist, and system prompt baked into the `.pipe`:

| Subagent                                           | Tools                                             | Lane in the build                                                                                                                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architect** (`agent_deepagent_subagent_arch`)    | none (emits design docs as reply content)         | Designs the simplest viable solution. Emits `ARCHITECTURE.md` and `OWNERSHIP.md` as inline content blocks; DevOps commits them. Sizes the engineering team 1-3 from real parallelizable work.                                            |
| **Engineer 1** (`agent_deepagent_subagent_eng1`)   | `tool_shell_eng1`, `tool_git_eng1`                | Default lane: frontend. Implements its slice on `feat/eng1-*`. Writes via `tool_git_eng1.write_file`.                                                                                                                                    |
| **Engineer 2** (`agent_deepagent_subagent_eng2`)   | `tool_shell_eng2`, `tool_git_eng2`                | Default lane: backend. Same shape as Engineer 1, parallel branch.                                                                                                                                                                        |
| **Engineer 3** (`agent_deepagent_subagent_eng3`)   | `tool_shell_eng3`, `tool_git_eng3`                | Default lane: data + DB. Same shape, parallel branch. Used only when the architect sizes the team to 3.                                                                                                                                  |
| **Reviewer** (`agent_deepagent_subagent_reviewer`) | `tool_git_reviewer` (read-only: `safeMode: true`) | Read-only verification gate between fan-out and merge. Inspects each `feat/eng*` branch via `tool_git_reviewer.diff` + `.read_file`; returns `APPROVED` or `REQUEST_FIXES`.                                                              |
| **DevOps** (`agent_deepagent_subagent_devops`)     | `tool_shell_devops`, `tool_git_devops`            | Owns `main`. Does bootstrap (`git init` once per repo), scaffold (per-project infra), commits design docs from Architect, runs the pre-merge smoke test per branch, merges feature branches, commits QA's emitted tests, runs the stack. |
| **QA** (`agent_deepagent_subagent_qa`)             | `tool_shell_qa`                                   | Two-phase: Phase A reads merged main via `git show` and emits test files as `(path, content)` pairs in its reply; DevOps commits them; Phase B runs the test command and reports pass/fail.                                              |

Each subagent has a paired `llm_anthropic_*` node (PM + eng1/2/3 + DevOps

- Architect + Reviewer on `claude-sonnet-4-6`; QA on `claude-haiku-4-5`).
  The agent prompts deliberately steer away from the deepagent built-in
  `write_file` / `read_file` / `stat_file` / `ls` — those are virtual
  agent-memory tools that don't touch disk. All real file writes go
  through the engine's `tool_git_<role>.write_file`.

## Per-project output layout

Builds land under `${ROCKETRIDE_OUTPUT_DIR}/<slug>/` so multiple projects
can coexist in one repo without colliding:

```
.output/
  .git/                      # shared git repo, one per workshop session
  .gitignore                 # shared, at repo root
  hello-world/
    index.html
    package.json
  notes-app/
    server.js
    db/schema.sql
```

Architect picks the kebab-case slug per request (or reuses an existing
one when PM signals `EXISTING PROJECT <slug>`). All file paths in
ARCHITECTURE.md / OWNERSHIP.md / engineer commits / tests are prefixed
with `<slug>/`. Bootstrap is repo-wide and runs once per conversation;
scaffold runs once per new project.

## Key node IDs referenced from Python

`api/app/libs/rocketride/chat.py` hard-codes one source-node ID:

| Constant in `chat.py` | Node ID     |
| --------------------- | ----------- |
| `WEBHOOK_SOURCE_ID`   | `webhook_1` |

`start_coding_agent()` calls `client.use(filepath=PIPELINE_PATH,
source=WEBHOOK_SOURCE_ID, ttl=0)` once at boot and reuses the returned
token for every turn. Each turn uses a single `client.send(token, data,
mimetype)` call — typed text goes as `text/plain`, attachments go as
their declared mimetype.

## Error humanization

`humanize_answer()` (also in `chat.py`) rewrites a few known upstream
Anthropic SDK error stack traces into user-facing reply text before the
WS handler emits the terminal `reply` frame. Today it handles the
"credit balance too low" 400; the pattern table is small and easy to
extend.

## Output

`response_answers_1` collects the agent's `answers` and returns them to
the calling SDK. The `first_answer_text` extractor in `chat.py` pulls
the first non-empty string out of the `answers` list (handles both the
direct `{"answers": [...]}` and the nested `{"result": {"answers":
[...]}}` shapes the SDK has used), runs it through `humanize_answer`,
and forwards it to the API layer, which sends it to the UI as a
`{type: "reply"}` WebSocket frame.

## When to edit the JSON by hand vs. through Studio

Almost never by hand. Studio handles node positions, lane wiring, and
component config. The two reasons you might touch the file directly:

1. **Code-coupled IDs.** If you rename a node (`webhook_1` → something
   else), Studio updates the JSON, but `WEBHOOK_SOURCE_ID` in `chat.py`
   needs to change in lockstep.
2. **System prompts.** They live in the JSON because Studio saves them
   there. Edit them in Studio; the diff in git tells you what changed.

If a `.pipe` diff has nothing but `ui.position` and `docRevision`
shifts, that's just Studio rearranging the canvas. Safe to commit.

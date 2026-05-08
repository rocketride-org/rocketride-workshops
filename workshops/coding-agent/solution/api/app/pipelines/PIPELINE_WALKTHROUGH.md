# Pipeline Walkthrough — `coding-agent.pipe`

The `.pipe` file is JSON managed by Studio. **Read the pipeline through
Studio's visual editor**; this doc is a printed map for participants who
want to know what the JSON declares without scrolling through 1,000+
lines of layout coordinates and system prompts.

## What the pipeline does

A user sends a request — typed text or an audio/image attachment. The
**Project Manager** agent (`agent_deepagent_1`, the entry agent) reads
the request and delegates to a team of specialist subagents using the
Deep Agent's built-in `task` tool. Specialists do the actual work
(design docs, code, merges, tests). The PM never writes code itself —
it decomposes, delegates, and summarizes. The final answer comes back
through `response_answers_1`.

Two doors open into the pipeline:

- **`chat_1`** (chat source) — typed text. Lands directly on the
  `questions` lane that feeds the PM.
- **`webhook_1`** (webhook source) — uploaded audio + images, optionally
  accompanied by a typed caption. Audio routes through `audio_transcribe_1`
  (speech → text), images through `ocr_1` (image → text), and any caption
  rides the `text` lane. All three streams meet at `question_1`, which
  emits a single `questions` payload to the PM.

```
                 chat_1 ──── questions ─────────────────────────┐
                                                                 │
                                                                 ▼
 webhook_1 ─ audio ─ audio_transcribe_1 ─ text ─┐           agent_deepagent_1
            │                                   ├─ question_1 ──── questions
            ├ image ─ ocr_1 ──────────── text ─┤            (Project Manager)
            └ text ─────────────────────── text ┘                │
                                                                 │
                                                          answers │
                                                                 ▼
                                                       response_answers_1
                                                          (UI sees this)
```

## The team (deep-agent subagents)

The PM coordinates these specialists. Each has its own LLM, tool
whitelist, and system prompt baked into the `.pipe`:

| Subagent                                         | Tools                              | Lane in the build                                                                                            |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Architect** (`agent_deepagent_subagent_arch`)  | filesystem (design-doc paths only) | Designs the simplest viable solution. Writes `ARCHITECTURE.md` and `OWNERSHIP.md`. Refuses to over-engineer. |
| **Engineer 1** (`agent_deepagent_subagent_eng1`) | shell, filesystem (root), git      | Default lane: frontend. Implements its slice on `feat/eng1-*`.                                               |
| **Engineer 2** (`agent_deepagent_subagent_eng2`) | shell, filesystem (root), git      | Default lane: backend. Same shape as Engineer 1, parallel branch.                                            |
| **Engineer 3** (`agent_deepagent_subagent_eng3`) | shell, filesystem (root), git      | Default lane: data + infra + CI. Same shape, parallel branch.                                                |
| **DevOps** (`agent_deepagent_subagent_devops`)   | shell, filesystem (root), git      | Owns `main`. Inits the repo, merges feature branches, runs the stack.                                        |
| **QA** (`agent_deepagent_subagent_qa`)           | shell, filesystem (root)           | Reads everything; writes tests under `${ROCKETRIDE_OUTPUT_DIR}/tests/`.                                      |

Each subagent has a paired `llm_anthropic_*` node feeding it model
output, and tool-shell / filesystem / git nodes giving it the
capabilities listed above.

## Key node IDs referenced from Python

`api/app/libs/rocketride/chat.py` hard-codes two of these:

| Constant in `chat.py` | Node ID     |
| --------------------- | ----------- |
| `CHAT_SOURCE_ID`      | `chat_1`    |
| `WEBHOOK_SOURCE_ID`   | `webhook_1` |

The Python code calls `client.use(filepath=PIPELINE_PATH, source=...)`
twice — once with each ID — so the engine spins up two pipeline
instances, one bound to each source door. Text turns route to the chat
instance via `client.chat()`; blob turns route to the webhook instance
via `client.send()` / `client.send_files()`.

## Output

`response_answers_1` collects the agent's `answers` and returns them
to the calling SDK. The `first_answer_text` extractor in `chat.py`
pulls the first non-empty string out of the `answers` list and forwards
it to the API layer, which sends it to the UI as a `{type: "reply"}`
WebSocket frame.

## When to edit the JSON by hand vs. through Studio

Almost never by hand. Studio handles node positions, lane wiring, and
component config. The two reasons you might touch the file directly:

1. **Code-coupled IDs.** If you rename a node (`chat_1` → something
   else), Studio updates the JSON, but `CHAT_SOURCE_ID` in `chat.py`
   needs to change in lockstep.
2. **System prompts.** They live in the JSON because Studio saves them
   there. Edit them in Studio; the diff in git tells you what changed.

If a `.pipe` diff has nothing but `ui.position` and `docRevision`
shifts, that's just Studio rearranging the canvas. Safe to commit.

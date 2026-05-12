# Instructor Script — Cody Rider Workshop

These are speaking notes, not read-aloud scripts. Use them as scaffolding. Pace yourself: every section needs to land its teaching point, not just demo nodes.

## Pre-event checklist (T minus 30 min)

- Solution boots clean (`pnpm dev` from `workshops/coding-agent/solution`)
- Exercise boots clean (with TODOs visible in the canvas)
- Pre-built todo node app exists in `~/cody-demo/todo-app/` and runs on a known port
- Anthropic API key set in solution `.env` for the live demos
- Trace file dir is empty (`rm api/logs/*.log` in solution dir)
- Slack/Discord open in another window for code-of-conduct issues
- Backup bug pre-staged in case the recommended one fires too quickly
- `coding-agent-new.pipe` and `coding-agent.pipe` both load without errors

---

# Intro (10 min)

## Slide 1 — Who is RocketRide and why (2 min)

Speaking points:

- Open-source AI runtime. MIT-licensed. C++ core, Python and TypeScript SDKs, MCP server.
- We exist because building AI workflows is currently a stitch-together-everything-by-hand problem. People are gluing scripts to OpenAI to vector DBs to LangChain to observability to deployment. That's not a stack, that's a hostage situation.
- We give you the runtime layer: visual builder for pipelines, real-time observability, and zero glue between models, tools, and storage.
- Three things to remember: pipelines are JSON files (version-controllable, portable), the runtime is multithreaded C++ (built for production throughput), and the canvas lives inside your IDE.

Don't say:

- "Platform". It's a runtime.
- "Compete with X". This is educational, not competitive.

## Slide 2 — Pulsar demo (3 min)

Speaking points:

- "Here's something I built on top of RocketRide. It's an AI market intelligence agent that drafts content from RSS sources."
- Live click: trigger one fan-out, show the agent fan-out completing in parallel, surface the eval scores at the end.
- Punch line: "This whole thing is one pipeline file. The runtime made the parallel fan-out trivial."

Time pressure tip: pre-load Pulsar with one finished run so you can scrub through events instead of waiting on a live LLM call.

## Slide 3 — Cody Rider demo (3 min)

Speaking points:

- "This is what we're building today, except I'll show you what it does after you build it."
- Open the pre-built todo node app, show it running.
- Type into the chat: "add a 'mark all complete' button at the top of the list".
- Talk while it runs: "Architect is deciding scope. Engineer 1 is on a branch. Reviewer checks it. DevOps will merge."
- Refresh the running app, show the new button. Click it.
- Punch line: "End-to-end change in one prompt. Seven agents collaborated — PM, Architect, Engineer 1-3, Reviewer, DevOps, QA. You're going to wire all of them in 90 minutes."

Backup if the live change fails: have a screen recording cued up. Don't apologize, just play it. "Here's what it looks like when the network behaves."

## Slide 4 — Workshop structure (2 min)

Speaking points:

- Six sections, 15 minutes each. Inside each: I walk through it (5 min), you build it (8 min), we recap together (2 min).
- The canvas is your focus. UI and API are pre-built. You build pipeline nodes only.
- The exercise repo has TODOs marking each section. The solution repo is your reference, but try the build before you peek.
- Two ground rules: (1) if you fall behind, jump to the next section's start state; don't drown trying to catch up. (2) Pair up if you want; this is a workshop, not an exam.

---

# Section 1 walkthrough script (5 min)

Open the exercise canvas, blank.

Walk-through points:

- "Every RocketRide pipeline starts with a source. We're using one: webhook. It handles every modality — typed text, voice notes, image uploads."
- Drop a Webhook node. "Three output lanes by type: audio, image, text."
- Drop Transcribe. Wire audio → audio. "When the UI uploads a voice note, it routes here. Whisper-class transcription, plug-and-play. Outputs text."
- Drop OCR. Wire image → image. "Same idea for screenshots and PDFs. We support DocTR and EasyOCR profiles."
- Drop Question. "This is the merger. Three text inputs (transcribed audio, OCR'd image, raw text from typed messages) become one normalized questions lane."

Teaching point to land:

- "Lanes are typed. The runtime won't let you connect an image lane to a text input. Wiring is type-checked at design time, not crash time."

Then start the solo timer.

## Section 1 solo coaching

Walk the room. Common stumbles:

- Trying to connect Webhook's audio/image lanes directly to Question. Tell them why: Question only accepts text inputs — they have to flow through Transcribe / OCR first.
- Missing the third Question input: Webhook's `text` lane also feeds Question directly (typed messages bypass the parsers).
- Not seeing the lane labels. Show them the hover state.
- Validation errors in the runtime panel. Read them out loud, point to the offending node.

## Section 1 recap (2 min)

Open the solution. Highlight the lane wiring. Note: "The Question node merges all three text streams — transcribed audio, OCR'd image, and raw text — into a single `questions` payload. The PM in Section 2 will subscribe to that lane and not care which modality the user used. That's the lane abstraction paying off."

---

# Section 2 walkthrough script (5 min)

Walk-through points:

- "Now we add the brain. Project Manager is an `agent_deepagent`, the orchestrator type. Its only job: receive questions, delegate, summarize."
- Drop Project Manager. Wire input questions ← Chat (and Question if Section 1 wired both).
- Drop Anthropic PM (`llm_anthropic`). "Agents need an LLM. But LLMs aren't data — they're a capability. So we use a control lane."
- Wire Anthropic PM control llm ← Project Manager. "Notice the lane is on the Anthropic node, sourced from PM. The control flows from the consumer to the provider."
- Drop Return Answers. Wire input answers ← Project Manager. "This drains agent answers back to the chat source."
- Open the PM config, paste the prompt from the lesson plan. Highlight the resource catalog table. "PM doesn't know how to do anything except delegate. Look at the prompt: 'You write nothing.'"

Teaching points:

- Input lanes are data. Control lanes are capabilities (LLMs, tools, sub-agents).
- The PM has a `task` tool injected automatically by the runtime when this node type runs. It's the orchestration primitive.

Common mistake to call out:

- "If you wire the Anthropic node's input lane instead of the control lane, the LLM never gets registered as the PM's brain. Use control."

## Section 2 solo coaching

Watch for: people pasting the prompt into the wrong field, or picking the wrong Anthropic profile (must be `claude-sonnet-4-6` to match the workshop). Send "hi" through chat after they save; PM should reply conversationally without invoking sub-agents.

## Section 2 recap (2 min)

"This is the smallest functional agent: source → orchestrator → response. The PM has no sub-agents, no tools, just an LLM. It can chat, it can refuse to delegate. In Sections 3 to 5 we give it a team of six specialists — Architect, three Engineers, Reviewer, DevOps, and QA."

---

# Section 3 walkthrough script (5 min)

Walk-through points:

- "Sub-agents attach to the PM via control lanes, type `deepagent`. The runtime exposes each one as a callable inside the PM's task tool."
- Drop Architect (`agent_deepagent_subagent`). Wire control deepagent ← Project Manager.
- Drop Anthropic Architect. Wire control llm ← Architect. "Each sub-agent gets its own LLM."
- "No filesystem tool here. The Architect doesn't write files — it emits ARCHITECTURE.md and OWNERSHIP.md content as text blocks in its reply. DevOps will commit them in Section 5. This keeps the design layer lean: one LLM, no tool wiring, no whitelist gymnastics."
- Paste the architect prompt. Highlight the "Sizing the team" section. "The Architect picks 1, 2, or 3 engineers per request based on actual parallelizable work. A hello-world page is one engineer; a full-stack notes app might be three."
- Highlight "Project scope". "Each new build gets its own subdirectory under `.output/<slug>/`. Multiple projects coexist in one repo. PM tracks the active slug across turns."

Teaching point:

- "Tool boundaries can be implemented two ways: by configuration (e.g. a filesystem whitelist) or by architecture (e.g. give the agent no write tool at all). The Architect uses the second: it CAN'T write files, so there's no risk of it touching code."

## Section 3 solo coaching

Common stumble: hooking up a filesystem tool because participants assume every agent needs one. Stop them — the Architect's role is design, not file IO.

After they save, have them send "build me a todo list app". Show the PM delegating, the architect replying with ARCHITECTURE.md + OWNERSHIP.md content blocks inline.

## Section 3 recap (2 min)

Show the agent's reply on screen — the content blocks are right there in the message. "The architect handed PM the design as text. PM now needs DevOps to commit it, and engineers to implement it. Section 4 is engineers; Section 5 is review + DevOps + QA. Onto Section 4."

---

# Section 4 walkthrough script (5 min)

This section is the technically heaviest. Pace yourself.

Walk-through points:

- "Up to three engineers. Identical structure. The pattern: sub-agent + LLM + shell + git. Four nodes per engineer — no separate filesystem tool, because the git tool's `write_file` method handles all file IO."
- Wire Engineer 1 fully on the canvas with all four nodes and three control connections. Talk while doing it.
- "Each engineer has its own shell and git tool. They share the same git repo on disk, but each one operates on its own branch. Branch isolation prevents file conflicts. Architect's OWNERSHIP.md prevents semantic conflicts."
- Open Shell Eng1 config. Walk through `workingDir`, `timeout`, `commandAllowlist` (empty = allow all). "In production you'd lock the allowlist down. For the workshop we trust ourselves."
- Open Git Eng1 config. Note `readOnlyMode: false` and `safeMode: false`. "Engineers need to write files (via `tool_git_eng1.write_file`) and commit. `readOnlyMode: true` is the default — flipping it lets the engineer write."
- Paste the Engineer 1 prompt.
- "Now duplicate. The fastest way: edit the .pipe JSON file directly. Copy the Engineer 1 block, paste it twice, change `eng1` to `eng2` and `eng3` everywhere, change `{N}` in the prompt."

Teaching point:

- "Parallel fan-out is the architectural feature, sized by the Architect. The Architect's OWNERSHIP.md lists 1, 2, or 3 engineers depending on real parallelizable work; PM dispatches only the engineers that were assigned, in one assistant turn. The runtime fans them out, and you get max(eng_i) wall time instead of sum. Same model, same prompt structure, parallel branches."

## Section 4 solo coaching

This is the hardest 8 minutes. Watch for:

- Tool ID collisions (eng2 still references `tool_shell_eng1`). Fix.
- Missing prompt customization (still says Engineer 1). Fix.
- Trying to re-wire on the canvas instead of editing JSON. Push them to JSON.

Be loud about the time: "Three minutes left. If you only have two engineers wired, that's fine; the demo will still run with two."

## Section 4 recap (2 min)

Send a build request that needs multiple engineers ("build me a notes app with a form and SQLite"). Open the canvas trace view, point at the engineer nodes lighting up simultaneously. "This is the parallel fan-out. Two or three branches getting committed in roughly the same wall time as one. The PM is now waiting for all of them to finish before delegating to the Reviewer and DevOps."

The reply will fail to review + merge (no Reviewer or DevOps yet). Pause. "Section 5 wires three more sub-agents to close the loop: Reviewer (read-only verification), DevOps (the merger and infra owner), and QA (tests)."

---

# Section 5 walkthrough script (5 min)

Walk-through points:

- "Three more sub-agents — three distinct shapes. DevOps owns `main` and writes everything (shell + git). QA emits tests and runs them, no write tool at all (shell only). Reviewer is read-only verification (git with `safeMode: true`, no shell)."
- Wire all three on the canvas. The control-lane pattern is the same as the engineers; speed through the structural wiring.
- Open the DevOps prompt. Highlight the phase list: bootstrap (once per repo), scaffold (once per new project), commit design docs, merge (with pre-merge smoke per branch), commit tests. "DevOps is the only role that touches `main` directly."
- Open the QA prompt. Highlight the Phase A/Phase B split. "QA can't write files. It emits test (path, content) pairs as text; PM hands them to DevOps to commit; then PM re-tasks QA to RUN them. Two phases per QA invocation."
- Open the Reviewer prompt. "Read-only. Sits BETWEEN engineer fan-out and DevOps merge. Returns APPROVED or REQUEST_FIXES. If REQUEST_FIXES, PM re-tasks the named engineer ONCE with explicit fix instructions, then re-runs Reviewer once. Failed twice → return unresolved issues to the user."

Teaching point:

- "Role boundaries can be implemented three ways: (1) by tool absence (Reviewer has no write tool), (2) by config (Reviewer's git is `safeMode: true` so writes fail at the runtime layer), (3) by prompt (QA is told to emit instead of write). The Architect uses #1; Reviewer uses #1 + #2; DevOps + Engineers use #3 only — they have write tools but the prompt scopes them. Use stronger enforcement when the LLM can't be trusted to follow text."

## Section 5 solo coaching

Faster than Section 4. Watch for:

- Forgetting to wire DevOps's `deepagent` control lane (most common omission).
- Forgetting to flip `readOnlyMode: false` on `tool_git_devops` — writes will fail loudly with "blocked in read-only mode" if they leave the default.
- Mistakenly giving Reviewer a shell tool. It doesn't need one.

After they save, send "build me a hello world page". Solo-build path: PM goes straight to DevOps (skip Architect, engineers, Reviewer, QA). Bootstrap + scaffold + files + commit + smoke + reply.

Then send "build me a notes app with a list page, a form, and SQLite". This engages the full workflow: bootstrap → scaffold → architect → engineers → **Reviewer** → DevOps merge → reply.

## Section 5 recap (2 min)

`ls api/.output/` in a terminal. Two project subdirs. `cd api/.output && git log --oneline --all --graph`. Show two clusters of commits — bootstrap + scaffolds + feature-branch merges — plus a `docs(<slug>): architecture` commit between scaffold and merge. "You just shipped two working apps through seven AI agents in parallel. The Reviewer is what makes the merge step trustworthy — it catches out-of-lane edits and architectural drift before they hit `main`. That's the workshop's headline."

---

# Section 6 walkthrough script (5 min)

This section has a different shape. You're not adding nodes; you're debugging.

Walk-through points:

- "Real systems break. RocketRide ships with full per-node tracing. Every lane write, every tool call, every error gets dumped to a file."
- Open `api/logs/{today}_tracer.log`. "This is the same data the canvas renders. Plain JSON. You can grep it, diff it, ship it to ops."
- Walk through one trace event. "`apaevt_node_started`, `apaevt_node_finished`, `apaevt_node_error`, `apaevt_flow` for per-lane writes, `apaevt_sse` for the agent's thinking events."
- Show how to filter for errors: `grep apaevt_node_error api/logs/*.log` or use VS Code's search.

Now introduce the bug:

- "I just made one config change. The pipeline still runs. The reply will be wrong. Find what I broke and fix it."
- Send "build me a hello world page" to demonstrate the broken behavior.

## Section 6 solo coaching

Hint cards (give in order, escalating):

1. Minute 4: "Look for `apaevt_node_error` in the trace."
2. Minute 6: "The error came from a tool call. Which node did the call?"
3. Minute 7: "Check that node's config. What changed about its access?"

If multiple participants are stuck at minute 7, just walk them through it. Don't let people leave demoralized.

## Section 6 recap (2 min)

Open the trace, highlight the error line, point at the node. Open the node config, show the pathWhitelist (or whatever the bug was), revert it. Re-run, show success.

Punch line: "The trace told you exactly which node, exactly which call, exactly which arguments. That's the observability story. You will use this every day in production."

---

# Closing (10 min)

## Final words (5 min)

Speaking points:

- "Today you built a seven-agent system in 90 minutes. The same pattern (orchestrator + specialist sub-agents + tool boundaries + read-only verification gate + observability) generalizes to anything you'd hand to an agent: research, customer ops, content, codebase migrations."
- Show `coding-agent-new.pipe` (the single-Cody-Rider baseline). "This is the same job done by one agent with all the tools. Cheaper, slower, less parallelism. We use it as an A/B baseline. Compare them after you get home."
- Where to go next: docs.rocketride.org, github.com/rocketride-org/rocketride-server, Discord (link).
- "Anything you build with RocketRide, drop in the awesome-rocketride repo. We feature community work."

## Survey (2 min)

QR code on slide. Three questions max. Examples:

- One thing that worked.
- One thing that broke.
- Would you use this in production?

## Q&A (3 min)

If no questions, prompt one yourself: "Most common question I get is about cost. Want me to walk through that?" Then talk about Anthropic API costs at workshop scale, where the runtime fits, and how to estimate for production.

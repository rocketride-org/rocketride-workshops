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
- Talk while it runs: "Architect is deciding scope. Engineer 1 is on a branch. DevOps will merge."
- Refresh the running app, show the new button. Click it.
- Punch line: "End-to-end change in one prompt. Six agents collaborated. You're going to wire all six in 90 minutes."

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

- "Every RocketRide pipeline starts with a source. We're using two: chat for live conversation, webhook for file uploads."
- Drop a Webhook node. "This emits three lanes by type: audio, image, text."
- Drop Transcribe. Wire audio → audio. "When the UI uploads a voice note, it routes here. Whisper-class transcription, plug-and-play. Outputs text."
- Drop OCR. Wire image → image. "Same idea for screenshots and PDFs. We support DocTR and EasyOCR profiles."
- Drop Question. "This is the merger. Three text inputs (transcribed audio, OCR'd image, raw text) become one normalized questions lane."
- Drop Chat. "Second source. Independent of the webhook flow. Emits the same questions lane directly. Downstream agents subscribe to the lane name, so both sources feed the same pipeline."

Teaching point to land:

- "Lanes are typed. The runtime won't let you connect an image lane to a text input. Wiring is type-checked at design time, not crash time."

Then start the solo timer.

## Section 1 solo coaching

Walk the room. Common stumbles:

- Trying to connect Webhook directly to Question without going through Transcribe/OCR. Tell them why: Question only accepts text inputs.
- Not seeing the lane labels. Show them the hover state.
- Validation errors in the runtime panel. Read them out loud, point to the offending node.

## Section 1 recap (2 min)

Open the solution. Highlight the lane wiring. Note: "Both Chat and Question emit on `questions`. The PM in Section 2 will subscribe to that lane and not care which source produced it. That's the lane abstraction paying off."

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

Watch for: people pasting the prompt into the wrong field, or picking the wrong Anthropic profile (must be `claude-opus-4-6` to match the workshop). Send "hi" through chat after they save; PM should reply conversationally without invoking sub-agents.

## Section 2 recap (2 min)

"This is the smallest functional agent: source → orchestrator → response. The PM has no sub-agents, no tools, just an LLM. It can chat, it can refuse to delegate. In Sections 3 to 5 we give it a team."

---

# Section 3 walkthrough script (5 min)

Walk-through points:

- "Sub-agents attach to the PM via control lanes, type `deepagent`. The runtime exposes each one as a callable inside the PM's task tool."
- Drop Architect (`agent_deepagent_subagent`). Wire control deepagent ← Project Manager.
- Drop Anthropic Architect. Wire control llm ← Architect. "Each sub-agent gets its own LLM. Same model is fine; in production you'd downsize for cheaper sub-agents."
- Drop FS Architect (`tool_filesystem`). Wire control tool ← Architect.
- Open the FS Architect config. Walk through the whitelist regex. "This is one of the most important config patterns in RocketRide. The pathWhitelist is enforced by the C++ runtime, not the LLM. The agent literally cannot write outside this regex."
- Note `allowMkdir: false`. "The architect writes top-level docs only. No subdirectories. We're enforcing the role at the filesystem layer."
- Paste the architect prompt.

Teaching point:

- "Tool boundaries are enforced by the runtime, not the model. The prompt asks nicely; the whitelist guarantees."

## Section 3 solo coaching

Common stumble: connecting the FS tool's input lane instead of control. Same mistake as Section 2 with Anthropic. Reinforce: "Tools and LLMs are control connections, not data."

After they save, have them send "build me a todo list app". Show the PM delegating, the architect replying, and the new files in `api/.output/`.

## Section 3 recap (2 min)

`cat api/.output/ARCHITECTURE.md` and `cat api/.output/OWNERSHIP.md` in a terminal. "The architect actually wrote real markdown. The PM read the reply, knows three engineers have slices, and now needs them. Onto Section 4."

---

# Section 4 walkthrough script (5 min)

This section is the technically heaviest. Pace yourself.

Walk-through points:

- "Three engineers. Identical structure. The pattern: sub-agent + LLM + shell + filesystem + git. Five nodes per engineer."
- Wire Engineer 1 fully on the canvas with all five nodes and four control connections. Talk while doing it.
- "Each engineer has its own shell, filesystem, and git tool. They share the same git repo on disk, but each one operates on its own branch. Branch isolation prevents file conflicts. Architect's OWNERSHIP.md prevents semantic conflicts."
- Open Shell Eng1 config. Walk through `workingDir`, `timeout`, `commandAllowlist` (empty = allow all). "In production you'd lock the allowlist down. For the workshop we trust ourselves."
- Open Git Eng1 config. Note `safeMode: true`. "Prevents history rewrites. The LLM cannot force-push or rebase main."
- Paste the Engineer 1 prompt.
- "Now duplicate. The fastest way: edit the .pipe JSON file directly. Copy the Engineer 1 block, paste it twice, change `eng1` to `eng2` and `eng3` everywhere, change `{N}` in the prompt."

Teaching point:

- "Parallel fan-out is the architectural feature. The PM dispatches three task calls in one assistant turn, the runtime fans them out, and you get max(eng1, eng2, eng3) wall time instead of sum. Same model, same prompt structure, three branches built concurrently."

## Section 4 solo coaching

This is the hardest 8 minutes. Watch for:

- Tool ID collisions (eng2 still references `tool_shell_eng1`). Fix.
- Missing prompt customization (still says Engineer 1). Fix.
- Trying to re-wire on the canvas instead of editing JSON. Push them to JSON.

Be loud about the time: "Three minutes left. If you only have two engineers wired, that's fine; the demo will still run with two."

## Section 4 recap (2 min)

Send a build request. Open the canvas trace view, point at the three engineer nodes lighting up simultaneously. "This is the parallel fan-out. Three branches getting committed in roughly the same wall time as one. The PM is now waiting for all three to finish before delegating to DevOps."

The reply will fail to merge (no DevOps yet). Pause. "Section 5 fixes that."

---

# Section 5 walkthrough script (5 min)

Walk-through points:

- "Two more sub-agents. DevOps mirrors an engineer's stack: shell, filesystem, git. QA drops the git tool because QA never commits."
- Wire DevOps and QA together on the canvas. Less detail than Section 4 because the pattern is identical.
- Open both prompts. Highlight: "DevOps owns main. QA can read everything but writes only inside `tests/`. The QA prompt enforces that — the filesystem is technically root-scoped, but the prompt restricts writes. We trade strict enforcement for read access. In production you'd add a second filesystem tool with narrower whitelist for writes."

Teaching point:

- "Role boundaries are a mix of prompt and config. Use config when the LLM cannot be trusted (filesystem writes, shell commands). Use prompt when the agent needs flexibility (read access, role discipline)."

## Section 5 solo coaching

Faster than Section 4. Watch for: people forgetting to wire DevOps's deepagent control lane (the most common omission because they're tired).

After they save, send "build me a hello world page". This is the moment of truth: full pipeline runs end to end. Bootstrap, design, fan-out, merge, reply.

## Section 5 recap (2 min)

`ls api/.output/` in a terminal. Real project on disk. `cd api/.output && git log --oneline --all --graph`. Show the merged main with three feature branches converging. "You just shipped a working app through six AI agents. That's the workshop's headline."

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

- "Today you built a six-agent system in 90 minutes. The same pattern (orchestrator + specialist sub-agents + tool boundaries + observability) generalizes to anything you'd hand to an agent: research, customer ops, content, codebase migrations."
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

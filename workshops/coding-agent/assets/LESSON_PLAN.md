# Cody Rider — Lesson Plan

A 6-section walkthrough for building a multi-agent coding agent with the RocketRide visual builder. Total workshop time: ~100 minutes (2-hour event includes 10 min intro + 10 min closing).

## How each section runs

Each of the six sections follows the same shape:

1. **Walkthrough (5 min)** — instructor demonstrates the concept on the canvas.
2. **Solo build (8 min)** — you wire the nodes yourself in the exercise project.
3. **Solution recap (2 min)** — instructor opens the solution, shows the difference, takes one or two questions.

You will not be asked to write any system prompts. They are provided in this document, copy-paste ready. Your job is to add the right nodes, connect the right lanes, and configure the tool whitelists.

## What you start with

The exercise project boots a UI, an API, and the RocketRide runtime. The empty pipeline file lives at `api/app/pipelines/coding-agent.pipe`. Open it in VS Code with the RocketRide extension and you'll see a blank canvas. The UI is fully wired and waits on a WebSocket; the API forwards your text into the pipeline and returns the first answer back. You only build the pipeline.

## Required environment

Set these in `api/.env` before Section 1 (covered in the workshop intro):

```
ROCKETRIDE_URI=localhost:5565
ROCKETRIDE_APIKEY=MYAPIKEY
ROCKETRIDE_ANTHROPIC_KEY=<your key>
```

`ROCKETRIDE_OUTPUT_DIR` is set automatically by the API on startup. It points to `api/.output/` and is the only directory the agents are allowed to touch.

---

# Section 1 — Source and Parsing (15 min)

## Concept

Every pipeline starts with a source. The coding agent supports two: `chat` for live conversation in the UI, and `webhook` for file uploads (audio voice notes, screenshots, PDFs). Audio files run through `transcribe`, images through `ocr`. Everything funnels into a single `question` node that normalizes the result into the `questions` lane the rest of the pipeline reads.

This section teaches the **lane model**. Source nodes emit lanes (audio, image, text, questions). Parsing nodes consume one lane and emit another. The downstream agent only cares about `questions`.

## What you wire

| Node       | Provider     | Why                                                                      |
| ---------- | ------------ | ------------------------------------------------------------------------ |
| Web Hook   | `webhook`    | Multimodal source: accepts audio + image + text uploads from the UI      |
| Transcribe | `transcribe` | Audio lane in, text out                                                  |
| OCR        | `ocr`        | Image lane in, text out (DocTR or EasyOCR depending on profile)          |
| Question   | `question`   | Merges transcribed audio + OCR text + raw text into one `questions` lane |
| Chat       | `chat`       | Second source: live chat from the UI, emits `questions` directly         |

## Wiring rules

- Webhook output lanes (`audio`, `image`, `text`) feed the matching parser lane inputs.
- Both `Transcribe` and `OCR` feed their `text` outputs into the `Question` node.
- The `Question` node emits on the `questions` lane.
- The `Chat` node also emits on the `questions` lane. Both sources can coexist; downstream agents subscribe to the lane name, not the source node.

## No prompts in this section

Source and parsing nodes are pure config. No system prompts.

## Solo activity

Add the five nodes to the canvas, wire the audio + image + text lanes through their parsers into Question, and confirm both Chat and Question emit on `questions`. Save the pipe file. Confirm the runtime reloads with no validation errors in the Connection Manager.

---

# Section 2 — Project Manager (15 min)

## Concept

The Project Manager is a `agent_deepagent` (the orchestrator type, not a sub-agent). It receives `questions` and produces `answers`. It writes nothing itself: its only tool is the auto-injected `task` tool, which it uses to delegate to sub-agents (which we add in Sections 3 to 5).

This is where you learn the **control lane** pattern. Agents need an LLM, but the LLM is not data input. It is attached as a `control` connection with `classType: "llm"`. Same goes for tools and sub-agents later. **Input lanes carry data. Control lanes carry capabilities.**

## What you wire

| Node            | Provider           | Why                                                              |
| --------------- | ------------------ | ---------------------------------------------------------------- |
| Project Manager | `agent_deepagent`  | The orchestrator. Decomposes user requests, delegates everything |
| Anthropic PM    | `llm_anthropic`    | Provides the LLM brain. `claude-opus-4-6` profile                |
| Return Answers  | `response_answers` | Drains the `answers` lane back to the chat source                |

## Wiring rules

- Project Manager **input** lane `questions` from `Chat` and from `Question` (it can have multiple input sources on the same lane).
- Anthropic PM **control** lane `llm` from Project Manager.
- Return Answers **input** lane `answers` from Project Manager.

## Project Manager system prompt

Paste this verbatim into Project Manager → Config → Default → System Prompt:

```
You are Cody Rider — the Project Manager. You receive user requests and orchestrate a team of specialists to deliver them.

=== Your tools ===
- `task` (auto-injected): your only tool. Delegate everything.

You write nothing. No code, no docs, no files. You decompose, delegate, and summarize.

=== Resource catalog (your team) ===

| Subagent | Specialty | Tools |
|---|---|---|
| Architect | Designs the simplest viable solution. Writes ARCHITECTURE.md + OWNERSHIP.md. Refuses to over-engineer. | filesystem (design docs only) |
| Engineer 1 | Full-stack engineer. Implements assigned slice on its own git branch. | shell, filesystem (root), git |
| Engineer 2 | Full-stack engineer. Same as Engineer 1, parallel branch. | shell, filesystem (root), git |
| Engineer 3 | Full-stack engineer. Same as 1+2, parallel branch. Default lane: data + infra + CI (overridable per architect's OWNERSHIP.md). | shell, filesystem (root), git |
| DevOps | Owns the main branch. Inits the repo, merges feature branches, runs the stack. | shell, filesystem (root), git |
| QA | Reads everything, writes tests in ${ROCKETRIDE_OUTPUT_DIR}/tests/. Runs unit/integration/e2e. | shell, filesystem (root) |

Project root: ${ROCKETRIDE_OUTPUT_DIR}

=== Phase order (substantial requests) ===

For anything that adds, removes, or modifies a feature:

1. **Bootstrap** (first turn of a project only):
   `task(DevOps, "if .git missing in ${ROCKETRIDE_OUTPUT_DIR}, run: git init, write a sensible .gitignore, commit on main with --allow-empty -m 'chore: init'. If .git exists, just confirm.")`
   You may skip this on later turns.

2. **Design**:
   `task(Architect, "<verbatim user request>")`. Wait for architect's reply containing chosen stack + ownership table.

3. **Challenge round** (if needed):
   If architect's choice looks heavyweight (React for a static page, Express for hello world, microservices for CRUD, auth where not asked, Docker for a non-deploy task) → re-engage architect ONCE: `task(Architect, "this looks heavyweight for the request. produce a simpler version using <baseline alternative>.")`. Cap: 1 challenge per turn.

4. **Fan out workers** in parallel based on architect's OWNERSHIP.md:
   ALL 3 engineers must be issued a `task` call this turn — architect's OWNERSHIP.md guarantees a slice for each. Issue all 3 in a SINGLE assistant message so they run in parallel.
   `task(Engineer N, "Read ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md and ${ROCKETRIDE_OUTPUT_DIR}/OWNERSHIP.md first. Then implement your slice on a feature branch. Branch name: feat/eng{N}-<slug>. Commit when done. Reply with branch name + files written.")`
   If OWNERSHIP.md somehow returned <3 slices, re-engage architect ONCE: `task(Architect, "split work across all 3 engineers, assign concrete files for each.")`. If OWNERSHIP.md marks a dependency as `serial:`, run those engineers sequentially across turns.

5. **Merge**:
   `task(DevOps, "merge these branches into main: <list>. Pre-check: git diff --name-only main...<branch> for each. If two branches modify the same path, abort and report the overlap. Otherwise: git checkout main && git merge --no-ff each. Resolve trivial conflicts; on hard conflicts, return them quoted. After merge, delete merged feature branches.")`
   If DevOps reports `OVERLAP` → re-engage architect to repartition.
   If DevOps reports `NO WORK on <branch>` → re-task that engineer ONCE with explicit "you forgot to commit. stage your assigned files and commit." Then re-merge.

6. **Validate** (optional):
   `task(QA, "checkout latest main and run a smoke test...")` when the user asked for tests or you want to verify the build.

7. **Reply**:
   Summarize: which docs were written, which engineers ran, branches merged, file list, how to run, any deferred work.

=== Trivial paths (skip the workflow) ===

Reply directly without any `task` for:
- Conversational greetings ("hi", "thanks")
- Status questions about existing code ("what does X do?")
- Single-line bug fixes that don't touch architecture

For anything that adds, removes, or modifies a feature: ALWAYS engage architect. When in doubt, engage architect.

=== Long-running processes ===

Engineers + DevOps report PIDs and ports back. To stop something, delegate to the role that started it. NEVER kill by image name.

=== Reply ===

Concise unless the user asks for detail. Always end with: branches merged, files in main, how to run, any deferred items.
```

## Solo activity

Add the three nodes, wire input/control/output, paste the prompt, and pick the `claude-opus-4-6` profile on the Anthropic node. Send "hi" through the chat. You should get a conversational reply (the trivial path). Send "build me a hello world page" and the PM will try to delegate, fail (no sub-agents yet), and likely apologize. That's expected. You're done with this section.

---

# Section 3 — Architect Sub-Agent (15 min)

## Concept

Sub-agents are `agent_deepagent_subagent` nodes. They attach to a parent `agent_deepagent` via a **control** connection of `classType: "deepagent"`. The PM doesn't need an input lane to talk to them. The runtime exposes each sub-agent as a callable tool inside the PM's `task` capability, named after the sub-agent node.

The Architect is the design agent. It writes `ARCHITECTURE.md` and `OWNERSHIP.md` and nothing else. To enforce that, its filesystem tool's `pathWhitelist` is restricted to the project root, and the prompt forbids touching anything else.

## What you wire

| Node                | Provider                   | Why                                          |
| ------------------- | -------------------------- | -------------------------------------------- |
| Architect           | `agent_deepagent_subagent` | Designs the system, refuses to over-engineer |
| Anthropic Architect | `llm_anthropic`            | LLM for the architect                        |
| FS Architect        | `tool_filesystem`          | Read/write inside `${ROCKETRIDE_OUTPUT_DIR}` |

## Wiring rules

- Architect **control** lane `deepagent` from Project Manager.
- Anthropic Architect **control** lane `llm` from Architect.
- FS Architect **control** lane `tool` from Architect.

## Filesystem tool config (FS Architect)

```
allowDelete: false
allowList:   true
allowMkdir:  false
allowRead:   true
allowStat:   true
allowWrite:  true
pathWhitelist: [{ whitelistPattern: "^${ROCKETRIDE_OUTPUT_DIR}(/.*)?$" }]
```

Note: `allowMkdir: false`. The architect writes only top-level docs.

## Architect system prompt

Paste verbatim into Architect → Config → Default → System Prompt:

```
You are the Architect.

=== HARD RULE: simplest solution wins ===

Choose the absolute simplest design that satisfies the request. Smallest dependency count, smallest cognitive load, smallest surface area. Forbidden defaults unless the user explicitly asks:

- No microservices for CRUD apps. One process.
- No auth where not asked. Anonymous endpoints are fine.
- No GraphQL, gRPC, message queues, event sourcing, CQRS.
- No frameworks where stdlib suffices. (No Express for static HTML. Node `http` is enough for small APIs. Plain CSS, no Tailwind/Bootstrap.)
- No TypeScript unless requested. Vanilla JS first.
- No build step where files can be served as-is.
- No tests unless requested.
- No `/api/v1/` versioning for fresh projects.
- No abstraction layers until duplicated 3 times.
- Boring defaults: SQLite > Postgres unless asked, fetch > axios, plain HTML form > React form.

=== HARD RULE: assign every engineer ===

The team has 3 engineers running in parallel. EVERY iteration must give all 3 a non-empty slice in OWNERSHIP.md. No `(unassigned)` lines, ever. Wall time = max(eng1, eng2, eng3), so leaving an engineer idle is wasted parallelism.

**Default lanes** (override only when a lane is genuinely empty):
- **Engineer 1 — Frontend**: HTML, CSS, client JS, UI components, static assets.
- **Engineer 2 — Backend**: server entry, API handlers, business logic, routes.
- **Engineer 3 — Data + Infra**: DB schema/migrations, seed scripts, .gitignore, package.json/requirements.txt, run.sh / start scripts, env templates, README.

**Lane absence — redistribute**:
- Frontend-only static site: eng1=HTML, eng2=client JS, eng3=README + run.sh + config.
- Backend-only CLI/script: eng1=core logic module, eng2=CLI entry/parser, eng3=README + package config + run script.
- Single-feature script: split by phase — eng1=skeleton + I/O, eng2=core algorithm, eng3=README + run script + config.

**Zero overlap still wins**. If a 3-way split forces two engineers onto the same file, mark it `serial:` rather than parallel-overwriting.

**eng3's slice must be functional** (config that actually configures, script that actually runs, schema that actually validates). Not a redundant docs file that just restates the obvious.

=== Tools ===

`tool_filesystem_arch` — write/read at root only:
- ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md
- ${ROCKETRIDE_OUTPUT_DIR}/PLAN.md (optional)
- ${ROCKETRIDE_OUTPUT_DIR}/ROADMAP.md (optional)
- ${ROCKETRIDE_OUTPUT_DIR}/DECISIONS.md (optional)
- ${ROCKETRIDE_OUTPUT_DIR}/OWNERSHIP.md (REQUIRED on every design)

No shell, no git, no other filesystem access.

=== Workflow ===

1. **Read first if it exists**: if ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md already exists, read it. Existing architecture is authoritative — amend it (append `## Iteration <N>` section) rather than rewrite.

2. **Decide minimum viable stack** for the user's request. Apply the HARD RULE above ruthlessly.

3. **Write/append ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md** with these sections:
   - **Goal** (one sentence)
   - **Stack** (languages, libraries, db, ports)
   - **Data model** (entities + fields, only if there's data)
   - **File layout** (concrete paths each file lives at)
   - **Cross-cutting decisions** (auth, validation, error format, env vars — usually "none" for small projects)
   - **Out of scope** (what we are NOT building)

4. **Write/overwrite ${ROCKETRIDE_OUTPUT_DIR}/OWNERSHIP.md** mapping each engineer to a list of CONCRETE FILE PATHS (not feature names). Format:
```

# Iteration N

Engineer 1 (frontend lane):

- <file path>
  Engineer 2 (backend lane):
- <file path>
  Engineer 3 (data + infra lane):
- <file path>

Dependencies: <if any>

```
HARD RULES:
- Zero file overlap between engineers.
- All 3 engineers MUST have at least one concrete file. No `(unassigned)` lines.
- eng3's slice must be functional infra.

5. **Reply** with: which docs you wrote (paths), the chosen stack (one sentence), the OWNERSHIP table, and any flagged dependencies.

=== Reply ===

Concise. The reply is the summary; the docs are the spec.
```

## Solo activity

Add the three nodes, wire the control lanes, paste the prompt. Send "build me a todo list app" through chat. You should see the PM delegate to the Architect, get back a stack proposal, and reply back to you. Check `api/.output/` for the new `ARCHITECTURE.md` and `OWNERSHIP.md` files. The PM will then try to delegate to engineers, fail, and apologize. Still expected.

---

# Section 4 — Three Engineer Sub-Agents (15 min)

## Concept

This is the **parallel fan-out** that defines RocketRide's architecture story. Three sub-agents, identical structure, run concurrently when the PM dispatches all three in one turn. Each engineer gets its own shell, filesystem, and git tool, scoped to its own working tree but sharing the same git repository. Branch isolation prevents file conflicts; the architect's `OWNERSHIP.md` prevents semantic conflicts.

For the workshop you'll wire one engineer in detail and then duplicate the node + tool stack twice. The prompts only differ in the engineer number and branch prefix.

## What you wire (per engineer, x3)

| Node            | Provider                   | Why                                         |
| --------------- | -------------------------- | ------------------------------------------- |
| Engineer N      | `agent_deepagent_subagent` | Implements its assigned slice on its branch |
| Anthropic Eng N | `llm_anthropic`            | LLM                                         |
| Shell Eng N     | `tool_shell`               | Runs build/install/test commands            |
| FS Eng N        | `tool_filesystem`          | Read/write project files                    |
| Git Eng N       | `tool_git`                 | Branch and commit operations                |

## Wiring rules (per engineer)

- Engineer N **control** lane `deepagent` from Project Manager.
- Anthropic Eng N **control** lane `llm` from Engineer N.
- Shell, FS, Git Eng N **control** lanes `tool` from Engineer N.

## Tool configs

Shell Eng N:

```
allowExternalEnv: false
commandAllowlist: []   (empty = allow any)
maxOutputBytes: 1048576
timeout: 60
workingDir: "${ROCKETRIDE_OUTPUT_DIR}"
```

FS Eng N:

```
allowDelete: false, allowList: true, allowMkdir: true, allowRead: true,
allowStat: true, allowWrite: true
pathWhitelist: [{ whitelistPattern: "^${ROCKETRIDE_OUTPUT_DIR}(/.*)?$" }]
```

Git Eng N:

```
authType: none
repoPath: "${ROCKETRIDE_OUTPUT_DIR}"
safeMode: true
```

## Engineer system prompt (template)

Replace `{N}` with `1`, `2`, or `3` and `{tool_*}` with the matching tool node IDs:

```
You are Engineer {N} — full-stack: UI, API, DB, infra.

=== Authority ===
Read first: ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md (spec) + ${ROCKETRIDE_OUTPUT_DIR}/OWNERSHIP.md (your files). Implement ONLY files listed for "Engineer {N}". If task contradicts either doc, reply "STOP: <conflict>".

=== Tools ===
tool_shell_eng{N}, tool_filesystem_eng{N}, tool_git_eng{N} — all scoped to project root.

=== Branch discipline (HARD) ===
1. `git checkout main` then `git checkout -b feat/eng{N}-<slug>` (kebab-case from assignment).
2. Commit each chunk with named files: `git add <files> && git commit -m "<role>: <what>"`. Never `git add -A` or `git add .`.
3. End every reply with `git log -1 --format='%h %s'` output.
4. Never commit to main. Never merge.

Uncommitted work = discarded by DevOps.

=== Long-running ===
Spawn detached → redirect to <branch-name>.log → capture PID → probe to verify. Stop by PID only.

=== Reply ===
Branch, files written, `git log -1` output, ports (if any), start/stop. Concise.
```

## Solo activity

Wire Engineer 1 fully (5 nodes + 4 control connections + prompt + tool configs). Then duplicate the entire stack for Engineer 2 and Engineer 3, updating IDs and the `{N}` placeholder. Save and re-send your earlier "build me a todo list app" prompt. You should see three branches get created in parallel and three replies from the engineers. The PM will then try to merge, fail (no DevOps yet), and apologize.

**Time pressure tip**: copy-paste the Engineer 1 node block in the raw `.pipe` JSON file three times and rename IDs. Faster than dragging from the canvas.

---

# Section 5 — DevOps and QA Sub-Agents (15 min)

## Concept

Two more sub-agents, but with different role boundaries. DevOps owns the main branch and merges everything. QA reads everything but only writes inside `tests/`. These boundaries are enforced by prompt + by tool configuration: the QA filesystem still has a root whitelist (so it can read), but the prompt restricts writes to `tests/`. (Stricter enforcement via narrower whitelist would also work; we trust the prompt here so QA can still inspect any file.)

## What you wire

DevOps stack (mirrors an Engineer stack):
| Node | Provider |
| ----------------- | ---------------------------- |
| DevOps | `agent_deepagent_subagent` |
| Anthropic DevOps | `llm_anthropic` |
| Shell DevOps | `tool_shell` |
| FS DevOps | `tool_filesystem` |
| Git DevOps | `tool_git` |

QA stack (no git):
| Node | Provider |
| ----------------- | ---------------------------- |
| QA | `agent_deepagent_subagent` |
| Anthropic QA | `llm_anthropic` |
| Shell QA | `tool_shell` |
| FS QA | `tool_filesystem` |

## Wiring rules

Same control-lane pattern as the Engineers. Both DevOps and QA attach `deepagent` control to Project Manager.

## DevOps system prompt

```
You are the DevOps engineer. Owns the main branch. Initializes the repo. Merges feature branches. Runs the stack.

=== Tools ===

- tool_shell_devops — workingDir is project root.
- tool_filesystem_devops — root-scoped, full read/write at root.
- tool_git_devops — repoPath is project root.

=== Phases ===

PM delegates a specific phase per call. Listen to the task description.

==== Phase: bootstrap ====

If .git does not exist:
1. `git init`
2. Write `.gitignore` (sensible defaults for the about-to-be-built stack, or just node_modules + .env if unknown)
3. `git add .gitignore && git commit -m "chore: init" || git commit --allow-empty -m "chore: init"`

If .git exists, just confirm and reply "repo already initialized at HEAD <hash>".

==== Phase: merge ====

1. **Pre-check**: for each `feat/eng*` branch in PM's task description, run `git diff --name-only main...<branch>`. Compare lists. If two branches modify the same path, ABORT — do not merge. Reply with "OVERLAP: branches X and Y both modify <path>. Need re-partition." PM will re-engage architect.
2. **Verify each branch has commits**: `git rev-parse --verify <branch>` AND `git log main..<branch> --oneline`. If empty, reply "NO WORK on <branch>". PM will re-task that engineer.
3. **Merge sequentially**: for each branch (in the order PM provided): `git checkout main && git merge --no-ff <branch> -m "merge: <branch>"`. On conflict: read both sides, resolve preferring the architect's intent in ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md, `git add` resolved files, `git commit`.
4. **Smoke test** (best-effort): try to install dependencies and import the entry point. If it fails, report the failure but still complete the merge.
5. **Cleanup**: `git branch -d feat/eng*` for each merged branch.

==== Phase: deploy/run ====

If asked to bring up the stack: spawn detached, redirect to server.log, capture PID, probe a health endpoint to verify. Stop by PID only — never by image name.

==== Phase: infrastructure ====

If the architect's design calls for it: write Docker, docker-compose, env files, CI configs at root.

=== Reply ===

For bootstrap: repo state, baseline commit hash.
For merge: which branches merged, conflicts resolved, smoke-test result, branch cleanup.
For deploy: PIDs, ports, how to stop.
```

## QA system prompt

```
You are the QA engineer.

=== Authority ===

Workspace: ${ROCKETRIDE_OUTPUT_DIR}/tests/ for writes. You can READ everything, but only WRITE inside tests/.

Cannot modify production code. If a test reveals a bug, return the failure to the PM with a brief repro tip.

=== Tools ===

- tool_shell_qa — workingDir is project root.
- tool_filesystem_qa — root-scoped, instruction-bound to writing only inside tests/.

=== Workflow ===

Triggered after DevOps merges main.

1. `git checkout main` so you test latest.
2. Read ${ROCKETRIDE_OUTPUT_DIR}/ARCHITECTURE.md to understand the stack.
3. Write integration / e2e tests inside ${ROCKETRIDE_OUTPUT_DIR}/tests/. Pick the appropriate runner: Vitest, Jest, Pytest, Playwright, Cypress, plain shell smoke scripts — match the project stack.
4. Run unit tests inside service dirs via shell with cwd-change (e.g. `cd ${ROCKETRIDE_OUTPUT_DIR}/<dir> && npm test`). Run e2e from inside tests/.
5. Report per-suite pass/fail counts, failing test names, brief repro tip per failure.

=== Reply ===

Tests written (paths), suites run, pass/fail summary. Concise.
```

## Solo activity

Wire DevOps (5 nodes) and QA (4 nodes) with their tool configs and prompts. Send a small build request: "build me a hello world page". You should now see the full pipeline run end to end: bootstrap → architect → 3 engineers parallel → devops merge → reply. The PM will skip QA unless you explicitly ask for tests. Confirm `api/.output/` contains a working project committed to a real git repo.

---

# Section 6 — Break It and Fix It with the Trace (15 min)

## Concept

You will not write a system from scratch in this section. The instructor introduces a single misconfiguration that breaks the pipeline in a non-obvious way. Your job: open the runtime trace file, follow the breadcrumb back to the broken node, fix it, re-run.

This teaches **observability**. The pipeline is started with `pipelineTraceLevel: "full"`, which causes every per-node lane write and tool invocation to dump to `logs/{YYYY-MM-DD}_tracer.log` in the API directory. You'll learn to read it.

## The bug (instructor introduces, do NOT read this if you want the discovery experience)

The instructor will change one of these in the live solution before participants begin solo work:

**Recommended bug**: change `FS Architect → pathWhitelist → whitelistPattern` from `"^${ROCKETRIDE_OUTPUT_DIR}(/.*)?$"` to `"^${ROCKETRIDE_OUTPUT_DIR}/architect/.*$"`. The architect will now fail every write because the path doesn't match. The PM will get an error reply from the architect and likely apologize without doing real work. The trace will show the architect's `tool_filesystem` calls returning permission errors.

Backup bug if the first is too easy: drop the `llm` control connection from `Anthropic Architect` to `Architect`. The architect node starts but has no LLM and errors immediately. Trace shows the failure at node-start time.

## What you do

1. Send a real build request: "build me a hello world page"
2. Pipeline runs, produces an unexpected/empty/error response.
3. Open `api/logs/{today}_tracer.log` in VS Code.
4. Search the trace for `apaevt_node_error` or `error` strings.
5. Identify which node failed and why.
6. Open the pipeline canvas, fix the misconfiguration.
7. Re-run the same prompt. Confirm fix.

## Solo activity

The 8 minutes are tight. Hint cards available from the instructor at minute 4 if you're stuck.

## Solution recap

Instructor opens the trace, walks through the relevant lines, shows the fix, re-runs to green.

---

# Optional reading: where to take this next

The single coding agent (`coding-agent-new.pipe` in the solution) is a one-agent baseline that does the same job with one Crew AI agent and a shared toolset. Compare the two pipes after the workshop to see the trade-off: the multi-agent fan-out is faster on parallelizable work, more expensive on tokens, and produces a cleaner git history. The single agent is cheaper and simpler, slower on big changes.

For your own projects: this same sub-agent + tool pattern works for any orchestration problem (research, content generation, codebase migrations, customer ops). Swap the prompts and tool whitelists; the structure is the same.

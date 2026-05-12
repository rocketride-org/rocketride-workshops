# Cody Rider — Lesson Plan

A 6-section walkthrough for building a multi-agent coding agent with the RocketRide visual builder. Total workshop time: ~100 minutes (2-hour event includes 10 min intro + 10 min closing).

The pipeline you'll build has a Project Manager that delegates to six subagents: Architect, Engineer 1, Engineer 2, Engineer 3 (sized 1-3 per request), Reviewer, DevOps, and QA. By the end of Section 5 you'll have the full team wired and a hello-world build running end to end.

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

Every pipeline starts with a source. The coding agent uses a single `webhook` source for every modality: typed text from the chat UI lands on its `text` lane; audio voice notes land on `audio`; uploaded images land on `image`. Audio runs through `transcribe`, images run through `ocr`. All three text streams funnel into a single `question` node that normalizes the result into the `questions` lane the rest of the pipeline reads.

This section teaches the **lane model**. The source node emits lanes (audio, image, text, questions). Parsing nodes consume one lane and emit another. The downstream agent only cares about `questions`.

## What you wire

| Node       | Provider     | Why                                                                      |
| ---------- | ------------ | ------------------------------------------------------------------------ |
| Web Hook   | `webhook`    | Multimodal source: accepts audio + image + text uploads from the UI      |
| Transcribe | `transcribe` | Audio lane in, text out                                                  |
| OCR        | `ocr`        | Image lane in, text out (DocTR or EasyOCR depending on profile)          |
| Question   | `question`   | Merges transcribed audio + OCR text + raw text into one `questions` lane |

## Wiring rules

- Webhook output lanes (`audio`, `image`, `text`) feed the matching parser lane inputs.
- Both `Transcribe` and `OCR` feed their `text` outputs into the `Question` node.
- The webhook's `text` output also feeds the `Question` node directly (typed messages bypass the parsers).
- The `Question` node emits on the `questions` lane that the Project Manager subscribes to.

## No prompts in this section

Source and parsing nodes are pure config. No system prompts.

## Solo activity

Add the four nodes to the canvas, wire the audio + image + text lanes through their parsers into Question, and confirm Question emits on `questions`. Save the pipe file. Confirm the runtime reloads with no validation errors in the Connection Manager.

---

# Section 2 — Project Manager (15 min)

## Concept

The Project Manager is an `agent_deepagent` (the orchestrator type, not a sub-agent). It receives `questions` and produces `answers`. It writes nothing itself: its only tool is the auto-injected `task` tool, which it uses to delegate to six sub-agents (which we add in Sections 3 to 5): Architect, Engineer 1, Engineer 2, Engineer 3, Reviewer, DevOps, and QA.

This is where you learn the **control lane** pattern. Agents need an LLM, but the LLM is not data input. It is attached as a `control` connection with `classType: "llm"`. Same goes for tools and sub-agents later. **Input lanes carry data. Control lanes carry capabilities.**

## What you wire

| Node            | Provider           | Why                                                              |
| --------------- | ------------------ | ---------------------------------------------------------------- |
| Project Manager | `agent_deepagent`  | The orchestrator. Decomposes user requests, delegates everything |
| Anthropic PM    | `llm_anthropic`    | Provides the LLM brain. `claude-sonnet-4-6` profile              |
| Return Answers  | `response_answers` | Drains the `answers` lane back to the source                     |

## Wiring rules

- Project Manager **input** lane `questions` from `Question`.
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
| Architect | Designs the simplest viable solution. Emits ARCHITECTURE.md + OWNERSHIP.md content in reply (no file writes). Refuses to over-engineer. | no write tool — relies on DevOps to commit |
| Engineer 1 | Full-stack engineer. Implements assigned slice on its own git branch. | shell, git (writes via tool_git_eng1.write_file) |
| Engineer 2 | Full-stack engineer. Same as Engineer 1, parallel branch. | shell, git (writes via tool_git_eng2.write_file) |
| Engineer 3 | Full-stack engineer. Same as 1+2, parallel branch. Default lane: data + DB. | shell, git (writes via tool_git_eng3.write_file) |
| Reviewer | Read-only verification of engineer branches against ARCHITECTURE/OWNERSHIP. | tool_git_reviewer (read-only) |
| DevOps | Owns the main branch. Inits the repo, scaffolds infra, merges feature branches, runs the stack, commits files on behalf of Architect and QA. | shell, git (writes via tool_git_devops.write_file) |
| QA | Reads via git, emits test (path, content) pairs in reply (DevOps commits). Runs unit/integration/e2e. | shell — no write tool |

Repo root: ${ROCKETRIDE_OUTPUT_DIR} (one shared git repo).

=== Project scoping ===

Every project lives in its own subdirectory of the repo root. Track the active project slug across turns. FRESH project → Architect picks a kebab-case slug. EXISTING project → pass the slug explicitly. All file paths in instructions, reviews, and replies are prefixed `<slug>/`. Bootstrap (git init, root .gitignore) runs ONCE per repo, not per project.

=== Phase order (substantial requests) ===

For anything that adds, removes, or modifies a feature:

1. **Bootstrap** (first turn of the whole conversation, once per repo):
   task(DevOps, "if .git missing, git init at repo root, write a sensible .gitignore, commit --allow-empty 'chore: init'").
   Skip on later turns.

1.5. **Scaffold infra** (first turn of each NEW project):
   task(DevOps, "scaffold infrastructure for project <slug> under ${ROCKETRIDE_OUTPUT_DIR}/<slug>/, stack hint: ...").

2. **Design**:
   FRESH: task(Architect, "FRESH PROJECT. <verbatim user request>"). Architect picks the slug.
   EXISTING: task(Architect, "EXISTING PROJECT <slug>. Prior ARCHITECTURE.md follows:\n<inline content>\n\nChange request: <verbatim>").
   Architect replies with chosen stack + slug + OWNERSHIP table + ARCHITECTURE.md/OWNERSHIP.md content blocks.

2.5. **Commit design docs**:
   task(DevOps, "commit these design docs: <slug>/ARCHITECTURE.md=<content>, <slug>/OWNERSHIP.md=<content>. Use tool_git_devops.write_file then commit on main."). Engineers cannot read uncommitted docs.

3. **Challenge round** (if needed):
   If architect's choice looks heavyweight → re-engage architect ONCE with a baseline alternative. Cap: 1 challenge per turn.

4. **Fan out workers** in parallel:
   Read OWNERSHIP.md to determine which engineers were assigned (1, 2, or 3). Fan out only the engineers OWNERSHIP.md lists in a SINGLE assistant message so they run in parallel. `serial:` dependencies run sequentially across turns.

5. **Review** (mandatory):
   task(Reviewer, "review branches: <list> against project <slug>. Verify against <slug>/ARCHITECTURE.md and <slug>/OWNERSHIP.md. Reply APPROVED or REQUEST_FIXES.").
   On REQUEST_FIXES → re-task the named engineer(s) ONCE with explicit fix instructions, then re-run Reviewer once. If still REQUEST_FIXES, return unresolved issues to the user.

6. **Merge**:
   task(DevOps, "merge these branches for project <slug> into main: <list>. Pre-check overlap, pre-merge smoke per branch, then merge --no-ff sequentially, delete merged branches.").
   On OVERLAP → re-engage architect to repartition. On NO WORK → re-task the engineer.

7. **Validate** (optional, when user asked for tests):
   (a) task(QA, "Phase A: read merged main via git show, emit integration test (path, content) pairs under <slug>/tests/.")
   (b) task(DevOps, "commit these test files under <slug>/tests/ ...")
   (c) task(QA, "Phase B: cd into <slug>/ and run the test command. Report pass/fail.")

8. **Reply**:
   Summarize: docs written, engineers ran, branches merged, files in main, how to run, deferred work.

=== Trivial paths (skip the workflow) ===

**Reply-only (no `task`)**: greetings, thanks, status questions about existing code.

**Solo-build path** (1 DevOps call, skip Architect + Engineers + Merge + QA) — when ALL hold:
- The request fits in ≤2 source files total ("hello world", "a single script", "one HTML page").
- No database, no auth, no external API, no framework setup beyond `npm init` / `pip install one-package`.
- No tests requested.
- User did NOT say "production-ready", "with tests", "multi-page", or name multiple components.

When solo-build applies, PM picks the kebab-case slug and issues exactly ONE call:
task(DevOps, "build project <slug> directly on main under ${ROCKETRIDE_OUTPUT_DIR}/<slug>/: <verbatim>. Steps: bootstrap → write files at <slug>/<path> → git add <slug>/... && commit → smoke-test → reply.").
Then reply to the user with DevOps's summary. Do NOT invoke Architect, Engineers, or QA.

**Full workflow** (architect + engineers + review + merge + optional QA): everything else. When in doubt, full workflow.

=== Long-running processes ===

Engineers + DevOps report PIDs and ports back. To stop something, delegate to the role that started it. NEVER kill by image name.

=== Reply ===

Concise unless the user asks for detail. Always end with: branches merged, files in main, how to run, any deferred items.
```

## Solo activity

Add the three nodes, wire input/control/output, paste the prompt, and pick the `claude-sonnet-4-6` profile on the Anthropic node. Send "hi" through the chat. You should get a conversational reply (the trivial path). Send "build me a hello world page" and the PM will try to delegate, fail (no sub-agents yet), and likely apologize. That's expected. You're done with this section.

---

# Section 3 — Architect Sub-Agent (15 min)

## Concept

Sub-agents are `agent_deepagent_subagent` nodes. They attach to a parent `agent_deepagent` via a **control** connection of `classType: "deepagent"`. The PM doesn't need an input lane to talk to them. The runtime exposes each sub-agent as a callable tool inside the PM's `task` capability, named after the sub-agent node.

The Architect is the design agent. It emits `ARCHITECTURE.md` and `OWNERSHIP.md` as content blocks in its reply — it has no file-write tool of its own. DevOps commits those docs to disk (Section 5). This keeps the Architect lean: a single LLM, no tool wiring, no filesystem config.

The Architect also **sizes the engineering team** per request (1, 2, or 3 engineers) based on the work it can genuinely parallelize. Don't engage all three on a hello-world page; don't try to split a multi-service build into one engineer.

## What you wire

| Node                | Provider                   | Why                                          |
| ------------------- | -------------------------- | -------------------------------------------- |
| Architect           | `agent_deepagent_subagent` | Designs the system, refuses to over-engineer |
| Anthropic Architect | `llm_anthropic`            | LLM for the architect (claude-sonnet-4-6)    |

## Wiring rules

- Architect **control** lane `deepagent` from Project Manager.
- Anthropic Architect **control** lane `llm` from Architect.

No filesystem, no shell, no git. The Architect writes via REPLY content, not via tools.

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

=== Project scope ===

Every project lives in its own subdirectory of `${ROCKETRIDE_OUTPUT_DIR}`. PM tells you whether the current request is FRESH or EXISTING:

- **FRESH PROJECT**: pick a kebab-case `<slug>` from the request (e.g. `hello-world`, `notes-app`). All file paths you emit MUST be prefixed `<slug>/`.
- **EXISTING PROJECT <slug>**: reuse the given slug verbatim. Amend the existing ARCHITECTURE.md by appending `## Iteration <N>`.

The very first line of every ARCHITECTURE.md is: `Project root: <slug>/`

=== Fast path (≤2 files total) ===

If the request fits in 2 or fewer source files ("hello world", "single script", "one HTML page", no DB, no auth, no tests):
- Skip ARCHITECTURE.md and OWNERSHIP.md entirely. Do NOT call any tool.
- Pick the project slug yourself.
- Reply with exactly: `fast-path: <stack one-liner>. Project: <slug>. Files: <slug>/<path1>[, <slug>/<path2>]. Recommend PM use solo-build path.`
- Stop.

=== Sizing the team ===

Decide how many engineers (1, 2, or 3) the request actually needs based on real parallelizable work. Default to 1 for any request that fits on a single concern. Use 2 when work splits cleanly into independent halves. Use 3 only when there are three genuinely independent lanes with non-overlapping files.

Default lanes (use only the ones that apply):
- Engineer 1, Frontend: HTML, CSS, client JS, UI components, static assets.
- Engineer 2, Backend: server entry, API handlers, business logic, routes.
- Engineer 3, Data layer: DB schema, migrations, seed scripts, data access modules.

Infrastructure (package.json, requirements.txt, .gitignore, run.sh, env templates, README, Docker, CI) is owned by DevOps via the scaffold phase. Do not assign these files to engineers.

OWNERSHIP.md lists only the engineers you are using. If you choose 1, OWNERSHIP.md has 1 section. If 2, 2. If 3, 3.

=== Tools ===

You have NO file-write tool. Emit the design documents as content blocks in your REPLY. The PM will hand them to DevOps to commit. Required documents:
- ARCHITECTURE.md (REQUIRED on every design)
- OWNERSHIP.md (REQUIRED whenever multiple engineers are involved)

No shell, no git, no `tool_filesystem_*` calls.

=== Workflow ===

1. **Decide minimum viable stack** for the user's request. Apply the HARD RULE above ruthlessly.

2. **Emit ARCHITECTURE.md content** in your reply. First line is always `Project root: <slug>/`. Then sections: Goal, Stack, Data model (if data), File layout (paths prefixed `<slug>/`), Cross-cutting decisions, Out of scope.

3. **Emit OWNERSHIP.md content** in your reply, mapping each engineer to a list of CONCRETE FILE PATHS (not feature names). Zero file overlap. Every assigned engineer MUST have at least one concrete file.

4. **Reply format**: each document as `path: <repo-relative-path>` followed by a fenced code block with the file content. Then a short summary: chosen stack (one sentence), the OWNERSHIP table inline, any flagged dependencies.

=== Reply ===

Document content blocks first (DevOps will commit them), summary second.
```

## Solo activity

Add the two nodes, wire the control lanes, paste the prompt. Send "build me a todo list app" through chat. You should see the PM delegate to the Architect, get back a stack proposal + ARCHITECTURE.md/OWNERSHIP.md content blocks, and reply back to you. (Files aren't yet on disk — DevOps will commit them in Section 5.) The PM will then try to delegate to engineers, fail, and apologize. Still expected.

---

# Section 4 — Engineer Sub-Agents (15 min)

## Concept

This is the **parallel fan-out** that defines RocketRide's architecture story. Up to three sub-agents, identical structure, run concurrently when the PM dispatches them in one turn. The architect sizes the team (1, 2, or 3) per request via OWNERSHIP.md — every assigned engineer has at least one concrete file. Engineers OWNERSHIP.md doesn't list aren't engaged at all.

Each engineer gets its own shell and git tool, scoped to the same git repository. Branch isolation (`feat/eng{N}-<slug>`) prevents file conflicts; the architect's `OWNERSHIP.md` prevents semantic conflicts. Engineers write files via their git tool (`tool_git_eng{N}.write_file`), not via a separate filesystem tool.

For the workshop you'll wire one engineer in detail and then duplicate the node + tool stack twice. The prompts only differ in the engineer number and branch prefix.

## What you wire (per engineer, x3)

| Node            | Provider                   | Why                                             |
| --------------- | -------------------------- | ----------------------------------------------- |
| Engineer N      | `agent_deepagent_subagent` | Implements its assigned slice on its branch     |
| Anthropic Eng N | `llm_anthropic`            | LLM (claude-sonnet-4-6)                         |
| Shell Eng N     | `tool_shell`               | Runs build/install/test commands                |
| Git Eng N       | `tool_git`                 | Branch + commit + `write_file` for all file I/O |

No separate filesystem tool. All file writes go through `tool_git_eng{N}.write_file`.

## Wiring rules (per engineer)

- Engineer N **control** lane `deepagent` from Project Manager.
- Anthropic Eng N **control** lane `llm` from Engineer N.
- Shell, Git Eng N **control** lanes `tool` from Engineer N.

## Tool configs

Shell Eng N:

```
allowExternalEnv: false
commandAllowlist: []   (empty = allow any)
maxOutputBytes: 1048576
timeout: 60
workingDir: "${ROCKETRIDE_OUTPUT_DIR}"
```

Git Eng N:

```
authType: none
repoPath: "${ROCKETRIDE_OUTPUT_DIR}"
readOnlyMode: false   # engineers can write + commit
safeMode: false       # destructive ops allowed (branch delete, etc.)
```

## Engineer system prompt (template)

Replace `{N}` with `1`, `2`, or `3`:

```
You are Engineer {N} — full-stack: UI, API, DB, infra.

=== Authority ===
Your task description includes an active project `<slug>`. Read first: `<slug>/ARCHITECTURE.md` (spec) + `<slug>/OWNERSHIP.md` (your files), via `tool_git_eng{N}.read_file`. Implement ONLY files listed for "Engineer {N}". ALL paths you write are prefixed `<slug>/` (e.g. `<slug>/src/index.js`). If task contradicts either doc, reply "STOP: <conflict>".

=== Tools ===

- tool_git_eng{N} — repoPath is `${ROCKETRIDE_OUTPUT_DIR}`. Use `.write_file` to CREATE/OVERWRITE files (paths RELATIVE to repo root). Use `.read_file` to read. Use `.checkout`, `.add`, `.commit`, `.branch`, `.log`, `.status` for git ops.
- tool_shell_eng{N} — workingDir is project root. For running `node`, `npm`, `pnpm`, `python`, etc.
- The deepagent built-in `write_file` / `read_file` / `stat_file` / `ls` are AGENT MEMORY ONLY — they do NOT touch disk. Do not use them for real files.

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

Wire Engineer 1 fully (4 nodes + 3 control connections + prompt + tool configs). Then duplicate the entire stack for Engineer 2 and Engineer 3, updating IDs and the `{N}` placeholder. Save and re-send your earlier "build me a todo list app" prompt. Architect's OWNERSHIP.md will pick 1, 2, or 3 engineers; you should see the matching number of branches get created in parallel. The PM will then try to review and merge, fail (no Reviewer or DevOps yet), and apologize.

**Time pressure tip**: copy-paste the Engineer 1 node block in the raw `.pipe` JSON file three times and rename IDs. Faster than dragging from the canvas.

---

# Section 5 — DevOps, QA, and Reviewer Sub-Agents (15 min)

## Concept

Three more sub-agents, each with a distinct role and a different tool footprint:

- **DevOps** owns `main`. It runs bootstrap (one-time per repo), scaffolds per-project infra, commits the Architect's design docs, runs a pre-merge smoke test, merges feature branches, and commits the tests QA emits. The only role with write access to `main`.
- **QA** has no file-write tool. It emits test files as `(path, content)` pairs in its reply (Phase A); DevOps commits them; QA then runs the test command (Phase B). Two-phase split.
- **Reviewer** is read-only. It sits BETWEEN engineer fan-out and DevOps merge — inspects each `feat/eng*` branch against ARCHITECTURE.md + OWNERSHIP.md and returns either `APPROVED` (DevOps may merge) or `REQUEST_FIXES` (PM re-tasks the engineer).

This is the order of operations once all three are wired:
bootstrap → scaffold → architect → engineers fan-out → **Reviewer** → DevOps merge → optional QA Phase A → DevOps commits tests → QA Phase B → reply.

## What you wire

DevOps stack:

| Node             | Provider                            |
| ---------------- | ----------------------------------- |
| DevOps           | `agent_deepagent_subagent`          |
| Anthropic DevOps | `llm_anthropic` (claude-sonnet-4-6) |
| Shell DevOps     | `tool_shell`                        |
| Git DevOps       | `tool_git`                          |

QA stack (no git, no filesystem):

| Node         | Provider                           |
| ------------ | ---------------------------------- |
| QA           | `agent_deepagent_subagent`         |
| Anthropic QA | `llm_anthropic` (claude-haiku-4-5) |
| Shell QA     | `tool_shell`                       |

Reviewer stack (read-only git, no shell):

| Node               | Provider                                 |
| ------------------ | ---------------------------------------- |
| Reviewer           | `agent_deepagent_subagent`               |
| Anthropic Reviewer | `llm_anthropic` (claude-sonnet-4-6)      |
| Git Reviewer       | `tool_git` (read-only, `safeMode: true`) |

## Wiring rules

Same control-lane pattern as the Engineers. All three attach `deepagent` control to Project Manager.

## Tool configs

Git DevOps:

```
authType: none
repoPath: "${ROCKETRIDE_OUTPUT_DIR}"
readOnlyMode: false   # DevOps writes + commits
safeMode: false
```

Git Reviewer (read-only):

```
authType: none
repoPath: "${ROCKETRIDE_OUTPUT_DIR}"
safeMode: true        # destructive ops blocked
# readOnlyMode is left absent so it defaults to true — Reviewer cannot write
```

Shell DevOps / Shell QA: same shape as the Engineer shell configs (workingDir = `${ROCKETRIDE_OUTPUT_DIR}`).

## DevOps system prompt

```
You are the DevOps engineer. Owns the main branch. Initializes the repo. Merges feature branches. Runs the stack.

=== Tools ===

- tool_git_devops — repoPath is `${ROCKETRIDE_OUTPUT_DIR}`. Use `.write_file` to CREATE/OVERWRITE files (paths RELATIVE to repo root, e.g. `.gitignore`, `src/index.js`). Use `.read_file` to read files. Use `.init`, `.add`, `.commit`, `.checkout`, `.merge`, `.branch`, `.status`, `.log`, `.diff` for git ops.
- tool_shell_devops — workingDir is project root. For running real binaries (`node`, `npm`, `pnpm`, `python`, `uv`) and any git command not exposed as a `tool_git_devops` method.
- The deepagent built-in `write_file` / `read_file` / `stat_file` / `ls` are AGENT MEMORY ONLY — they do NOT touch disk. Do not use them for real files.

=== Phases ===

PM delegates a specific phase per call. Listen to the task description.

==== Phase: bootstrap ====

Bootstrap is repo-wide, NOT per-project. The `.git` and root `.gitignore` live at `${ROCKETRIDE_OUTPUT_DIR}` (repo root). Multiple projects share this one repo, each in its own subdir. Run bootstrap once per conversation; subsequent project requests skip this phase.

1. `tool_git_devops.init` (idempotent, at repo root).
2. `tool_git_devops.write_file` at path `.gitignore` (RELATIVE, at repo root) with broad defaults that cover multiple project subdirs (`node_modules/`, `*/node_modules/`, `.env`, `*.log`, `__pycache__/`, `.DS_Store`, `dist/`, `build/`).
3. `tool_git_devops.add` files=[`.gitignore`], then `tool_git_devops.commit` message=`chore: init` (use `--allow-empty` semantics if nothing staged).
4. Reply with the HEAD commit (`git log -1 --format='%h %s'`).

==== Phase: scaffold ====

Runs once per NEW project (PM passes the `<slug>`), after repo bootstrap and BEFORE the architect designs. Infrastructure files go under `<slug>/`, NOT at repo root.

1. Write project-scoped infrastructure under `<slug>/`:
   - `<slug>/package.json` (Node) or `<slug>/requirements.txt` (Python)
   - `<slug>/run.sh` or equivalent start script
   - `<slug>/.env.template` if env vars are needed
   - `<slug>/README.md` skeleton
2. Commit on main: `chore(<slug>): scaffold infra`.
3. Reply with files written and the commit hash.

==== Phase: commit design docs ====

After Architect emits ARCHITECTURE.md + OWNERSHIP.md content blocks, PM passes them here. `tool_git_devops.write_file` for each under `<slug>/`, then commit on main with `docs(<slug>): architecture`.

==== Phase: merge ====

1. **Pre-check (path overlap)**: for each `feat/eng*` branch, `git diff --name-only main...<branch>`. If two branches modify the same path, ABORT and reply "OVERLAP: branches X and Y both modify <path>. Need re-partition."
2. **Verify branch has commits**: if empty, reply "NO WORK on <branch>".
3. **Pre-merge smoke (per branch)**: `git checkout <branch>`, working_dir=<slug>/, install deps per stack, run the smoke entrypoint (`node -e "require('./')"` for Node, `python -c "import <main>"` for Python). If smoke fails, ABORT for that branch and reply "SMOKE_FAIL on <branch>: <error>". Do not proceed until all branches pass.
4. **Merge sequentially**: `git checkout main && git merge --no-ff <branch>`. Resolve trivial conflicts preferring ARCHITECTURE.md intent.
5. **Cleanup**: `git branch -d feat/eng*` for each merged branch.

==== Phase: commit tests ====

PM passes QA's emitted test files. `tool_git_devops.write_file` each under `<slug>/tests/`, then commit on main with `test(<slug>): integration suite`.

==== Phase: deploy/run ====

If asked to bring up the stack: spawn detached, redirect to server.log, capture PID, probe a health endpoint to verify. Stop by PID only.

=== Reply ===

For each phase: state of the repo, commit hash(es), and any abort reasons.
```

## QA system prompt

```
You are the QA engineer.

=== Authority ===

Your task description includes an active project `<slug>`. Workspace for emitted test files: `<slug>/tests/`. You can READ everything via `git show HEAD:<path>`, but tests you emit go through DevOps to be committed.

Cannot modify production code. If a test reveals a bug, return the failure to the PM with a brief repro tip.

=== Tools ===

- tool_shell_qa — workingDir is project root. Use `git show HEAD:<path>` to READ committed files. Use `node`, `npm`, `pytest`, etc. to RUN tests after DevOps has committed them.
- You have NO file-write tool. Emit test files as `(path, content)` pairs in your reply. The PM will hand them to DevOps to commit under `<slug>/tests/`.

=== Workflow ===

Triggered after DevOps merges main. Two phases:

**Phase A (emit):**
1. `git show HEAD:<slug>/ARCHITECTURE.md` to read the stack.
2. Decide the runner (Vitest, Jest, Pytest, Playwright, Cypress, shell smoke).
3. Reply with a structured list: each test file as `path: <slug>/tests/<file>` followed by a fenced code block with the file content.

**Phase B (run, on PM's follow-up call):**
1. `tool_shell_qa.execute` with `working_dir=<slug>/` to run the configured test command.
2. Report per-suite pass/fail counts, failing test names, brief repro tip per failure.

Integration + e2e only. Don't duplicate engineer-owned unit tests.

=== Reply ===

Phase A: list of `(path, content)` pairs and which runner was chosen.
Phase B: suites run, pass/fail summary. Concise.
```

## Reviewer system prompt

```
You are the Reviewer.

=== Authority ===
You verify each engineer's branch against ARCHITECTURE.md and OWNERSHIP.md BEFORE DevOps merges to main. You read everything; you write nothing.

=== Tools ===

- tool_git_reviewer — repoPath is `${ROCKETRIDE_OUTPUT_DIR}`, READ-ONLY (`safeMode: true`). Use `.read_file` to read committed files, `.log`, `.status`, `.diff`, `.branch`, `.checkout` for inspection. You cannot write or commit.
- The deepagent built-in `write_file` / `read_file` / `stat_file` / `ls` are AGENT MEMORY ONLY — they do NOT touch disk. Do not use them.
- You have no shell. No `tool_filesystem_reviewer` calls.

=== Workflow ===

Triggered after engineers commit their feature branches, before DevOps merges.

For each `feat/eng*-<slug>` branch listed in your task:

1. `tool_git_reviewer.read_file` `<slug>/ARCHITECTURE.md` and `<slug>/OWNERSHIP.md`.
2. `tool_git_reviewer.diff` to inspect the branch against main; `tool_git_reviewer.read_file` for changed file contents.
3. Verify per branch:
   - **In-lane**: engineer modified ONLY files OWNERSHIP.md assigned to them. Out-of-lane edits → REQUEST_FIXES.
   - **Architectural fidelity**: code respects the chosen stack, file layout, cross-cutting decisions. Drift → REQUEST_FIXES.
   - **Cross-branch imports resolve**: eng1 imports a symbol eng2 was supposed to provide → flag if missing.
   - **Obvious bugs visible in the diff** (missing return, off-by-one, unresolved TODO, syntax error) → flag with file + line.
   - **Security**: secrets committed, eval of user input, shell injection → flag.

4. Output ONE of:
   - `APPROVED: <one-line summary>`
   - `REQUEST_FIXES:` with per-branch issues (file, problem, one-sentence fix).

=== Reply ===

APPROVED: <summary>

OR

REQUEST_FIXES:
  branch <name>, file <path>: <issue>. Fix: <instruction>.
  (repeat per issue)

Concise. Specific. Actionable.
```

## Solo activity

Wire DevOps (4 nodes), QA (3 nodes), and Reviewer (3 nodes) with their tool configs and prompts. Send a small build request: "build me a hello world page". This is a fast-path / solo-build case, so PM will go straight to DevOps (skip Architect + engineers + Reviewer). Confirm `api/.output/hello-world/` contains a working project committed to a real git repo.

Then send something bigger: "build me a notes app with a list page, a new-note form, and SQLite storage". This engages the full workflow: bootstrap → scaffold → architect → engineers fan-out (probably 2-3) → Reviewer (APPROVED) → DevOps merge → reply. If the user adds "with tests", QA's Phase A/B kicks in. Confirm both projects coexist under `api/.output/` in their own subdirs.

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

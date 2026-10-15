# Facilitator notes: Specter Mutual

Operational notes for running this module. Time box: **40 minutes**.

## Run of show

| Guide step | Time | What happens | Where people fall behind |
| --- | --- | --- | --- |
| Start the project | 6 min (0:00) | Folder, `python3 -m pip install rocketride`, `.env` in the editor, `rocketride init`, `rocketride app create … --developer <id>`, then the manifest edit in `apps/specter-mutual/package.json` | `.env` made in PowerShell (UTF-16) or in the wrong folder; `rocketride` not on `PATH`; pnpm missing; `--developer` left out; pasting over the top-level `"description"` instead of the one inside `appManifest`. |
| Build the brain | 15 min (0:06) | Paste four files, start `claude` in a second terminal, four prompts: beat 1, beat 2, beat 3 (`python3 policy.py` + `check.py`), fraud claim | A missing or stale `ROCKETRIDE_ANTHROPIC_KEY`: the answer *is* the error. Claude waiting on a permission prompt nobody noticed. Give the fraud test time; it's the point of the module. |
| Portal logic | 2 min (0:21) | Paste `policy.ts`, `claims.ts`, `apiKey.ts`, one section each |
| Theme integration | 2 min (0:23) | Paste `theme.ts`, `useSpecterTheme.ts` |
| Build the portal | 9 min (0:25) | One prompt builds the screens and runs `tsc`, then App Builder Design → Preview | Claude takes 3 to 6 minutes; talk through the table of pasted files meanwhile. The first Preview runs `pnpm install` and starts a dev server. |
| Deploy from the App Builder | 6 min (0:34) | Deploy → build ticker → Publish to… → @me, then file claims on cloud.rocketride.ai | The cloud build takes a minute or two. A namespace banner means the app id doesn't match the developer id. |

**What counts as done:** the portal is published to `@me`, opens on cloud.rocketride.ai and reviews a claim. The fraud test in Build the brain is the moment to stop and talk: the agent can be fooled, the policy engine can't.

Attendees do the setup and the deploy by hand, paste the files that must be exact (pipelines, policy engine, portal logic and theme), and use Claude Code for everything that's just glue or UI. The notebooks are a fallback only.

## The prompts

All are in the guide with Copy buttons; listed here so you know what to expect.

| Step | Prompt does | Expected result |
| --- | --- | --- |
| Beat 1 | Writes `review.py` (`client.use(filepath=…, use_existing=True)`, `client.send(…, "text/plain")`), runs it on `claims-4a.pipe` for SM-1001, SM-1003, SM-1004 | Three letters, no decisions |
| Beat 2 | Runs `review.py` on `claims.pipe` for SM-1001 to SM-1004, saves `agent-answers.json` | JSON answers: approve, deny, deny, escalate |
| Beat 3 | `python3 policy.py` (terminal), then a prompt writes and runs `check.py` (agent answers through `adjudicate()`) | `policy.py`: deny, payout 0, Policy override note. `check.py`: SM-1001 approved $800, SM-1002/1003 denied, SM-1004 escalated |
| Try to beat it | Sends SM-1007 (Basic possession as "minor poltergeist activity") and adjudicates it | Final decision deny |
| Portal | Builds `src/components/*` and `App.tsx` on the five pasted files, runs `pnpm exec tsc --noEmit` | Portal in the Preview; tsc clean |
| Fold: key fixed | Stops both running pipelines (`get_task_token` + `terminate`) | Next run restarts with the new key |
| Fold: namespace banner | Changes the developer id in `package.json`, `.rrapp`, `src/AppDescriptor.ts` | Deploy tab editable |

Claude's portal varies from run to run. The logic files are pasted, so decisions, payouts and policy overrides are always the reference behaviour; only the layout differs.

## Before the event

- [ ] `ROCKETRIDE_ANTHROPIC_KEY` is set and current at org level in RocketRide Variables. A stale key doesn't fail loudly (see below).
- [ ] Decide which org attendees deploy into, and that it has a developer id. Tell attendees the id: they pass it to `rocketride app create --developer`. To claim one live it must be empty: a sys.admin clears it in admin-ui → Orgs → the org → Edit → Developer Id.
- [ ] Every attendee account has a RocketRide Cloud subscription and an API key, and attendees did the guide's Set up at home step: editor and RocketRide extension, Python, Node, pnpm, and Claude Code signed in.
- [ ] Run the guide end to end yourself on the venue wifi, in a fresh folder: Start the project, all four Build the brain prompts, the portal prompt, the Preview, then Deploy and Publish. Time Claude's portal build and the cloud build.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pip`: command not found | macOS has no bare `pip`. | `python3 -m pip install rocketride` (Windows: `python -m pip install rocketride`). |
| `rocketride`: command not found | pip's scripts folder isn't on `PATH`. | `python3 -m rocketride.cli.main` in place of `rocketride` (Windows: `python -m …`), same arguments. |
| pip can't install | No internet or a proxy; or `externally-managed-environment`, a system Python. | Switch networks; for `externally-managed-environment`, make a venv in the project folder and install there. |
| `Probing http://localhost:5565` … `Connect call failed` | Init didn't find `.env`: not saved, or made in another folder. | Open the project folder with File → Open Folder, make `.env` there, save, `rocketride init` again. |
| `UnicodeDecodeError … byte 0xff` | `.env` written with `echo > .env` in Windows PowerShell (UTF-16). | Reopen it, Save with Encoding → UTF-8, or recreate it with the editor's New File. |
| `Error: No authorization provided` / `Stored credentials … were rejected` | Key missing from `.env`, or wrong/revoked. 1.4.0 can't sign in through the browser. | Fix the key line in `.env`, save, `rocketride init` again. |
| `app create` fails on pnpm | pnpm (or Node) missing, or the terminal predates the install. | `npm install -g pnpm@latest` (Node 20+ first), restart the editor, run `app create` again. |
| `package.json` red squiggles after the manifest edit | Pasted over the wrong `"description"`, or a comma lost. | The snippet replaces the `"description"` line *inside* `appManifest`; each line there ends in a comma except the last. |
| App id is `local.specter-mutual`, or a namespace banner | `--developer` left out or wrong. The id is in `package.json`, `specter-mutual.rrapp` and `src/AppDescriptor.ts`. | Early: delete `apps/specter-mutual/` and recreate. Later: the guide's Deploy fold has a Claude prompt that changes all three. |
| Beat answers are `LLM error …` | A bad, missing or stale Anthropic key. The run doesn't fail; the error text comes back as the answer. `review.py` stops on it. | Fix `ROCKETRIDE_ANTHROPIC_KEY` in Variables, run the guide's stop-pipelines prompt (Variables are read when a task starts), run the beat again. |
| One attendee still gets the key error with a valid org key | A user-level variable with the same name overrides the org-level one. | Fix or delete the attendee's user-level `ROCKETRIDE_ANTHROPIC_KEY`, stop the pipelines, retry. |
| Claude's script can't import `rocketride` | Claude ran a different Python (`python` vs `python3`, or outside the venv). | Tell Claude which command works in the first terminal, or have it install `rocketride` for its Python. |
| Nothing reaches the agent, or the answer is empty | The claim was sent as `application/json`, which lands on another webhook lane. | The prompt says `"text/plain"`; ask Claude to check `review.py` sends that. |
| "Pipeline is already running" | One task per user + pipeline; scripts and the portal share it. | Everything attaches with `use_existing` / `useExisting`. If it persists, run the stop-pipelines prompt. |
| Beat 1 replies ignore the letter prompt | `llm_anthropic` has no system-prompt field, and the model often ignores the Prompt node. | Expected. A bare model sounds confident and decides nothing. Instructions arrive with the agent in beat 2. |
| SM-1006 never shows the coverage cap | The agent reads "up to $1,000" as a ceiling and denies the $2,400 Basic claim. | Expected. The cap shows in `policy.py`. |
| Claude's portal fails `tsc` and can't fix it | Usually a pasted logic file got truncated, or Claude edited one. | Re-copy the five pasted files, ask Claude to run tsc again. Still stuck: the `03-ui-build.ipynb` fallback. |
| The App Builder won't open, `.rrapp` opens as text | Workspace not trusted: Restricted Mode turns the extension off. | Trust the folder (status bar or Workspaces: Manage Workspace Trust), reopen the `.rrapp`. |
| The Preview shows errors or stays blank | A compile error, or the first `pnpm install` still running. | Design → Errors pane; paste the error into Claude. |
| The Preview loops on sign-in | Inherit Auth is off, or the editor's own session expired. | Check Inherit Auth in the Preview toolbar, then Reload; if it persists, sign out and back in to RocketRide in the editor. |
| pnpm: `ENOENT … .rocketride/client/rocketride.tgz` | The app's `file:` dependencies point at `.rocketride/`, which init downloads. | Run `rocketride init` again in the project folder, then reopen the `.rrapp`. |
| Deploy: the version card shows **failed** | The source doesn't build on the server (usually a type error). | Click the failed badge for the build log; paste the reason into Claude, check the Preview, deploy again. |
| Published, but not on the desktop | The desktop picks up new apps on refresh. | Reload cloud.rocketride.ai. Check the Deploy tab's "Where this app is live" lists `@me`; if not, Publish to… → @me again. |
| The portal asks for an Anthropic key | No `ROCKETRIDE_ANTHROPIC_KEY` the portal's user can see. | Paste a key: the portal saves it to the user's Variables. |

## Why the policy engine sits outside the pipeline

Attendees ask why `policy.py` isn't a node. RocketRide has no Python node on the data lanes: `tool_python` is only reachable as an agent tool call. And a guardrail the agent controls is not a guardrail, which is the lesson of the module. So the pipeline returns the agent's recommendation, and the policy engine decides: `policy.py` in Build the brain, its TypeScript twin `policy.ts` in the portal. That's also why both are pasted, never generated.

## Fallback guide

Each guide step has a **Stuck? Use the fallback** fold. Attendees download `specter-mutual.ipynb` plus the part, save both next to `.env`, run `python3 -m pip install nbformat`, pick the Python they installed RocketRide into as the kernel, and run the cells in order. None of them installs, scaffolds or deploys: the app must exist from `rocketride app create`.

- **Start the project → `01-project-init.ipynb`:** writes the manifest (`authenticated`, `include`).
- **Build the brain → `02-pipeline-build.ipynb`:** writes the test claims, both pipelines and `policy.py`, runs the three beats and the fraud test. Its `# Skip ahead` cell only writes the files.
- **Build the portal → `03-ui-build.ipynb`:** writes the finished reference portal, replacing Claude's. The Preview rebuilds on save.
- **Deploy:** no notebook. Read the build log from the failed badge, fix with Claude, deploy again; to publish an older version, Publish to… → @me on its card.

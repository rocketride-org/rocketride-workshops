# Facilitator notes: Specter Mutual

Operational notes for running this module. Time box: **40 minutes**.

## Run of show

| Step | Time | Where people fall behind |
| --- | --- | --- |
| Start the project: folder, `pip install rocketride nbformat`, `rocketride init`, `rocketride app create`, then Part 1 | 6 min | The first browser sign-in; `rocketride` not on `PATH`; pnpm missing; `app create` without `--developer`. `app create` downloads RocketRide's app packages and runs `pnpm install`. Notebooks saved outside the project folder get "No .env here". |
| 2: Pipeline build | 15 min | A missing or stale `ROCKETRIDE_ANTHROPIC_KEY`: the answer *is* the error. Give the fraud test time; it's the point of the module. |
| 3: UI build, then the App Builder's Preview | 12 min | Running Part 3 before Part 2 finished (it stops and says so). The first Preview runs `pnpm install` and starts a dev server; slow wifi makes it slower. |
| Deploy from the App Builder | 7 min | The cloud build takes a minute or two; have people watch the build ticker. A namespace banner means the app id doesn't match the developer id. |

**What counts as done:** the portal is published to `@me`, opens on cloud.rocketride.ai and reviews a claim. Part 2's fraud test is the moment to stop and talk: the agent can be fooled, the policy engine can't.

Attendees do the setup and the deploy by hand, from the guide. That's deliberate: they should leave knowing how little it takes to start a RocketRide project and ship it. The notebooks hold only the build.

## Before the event

- [ ] `ROCKETRIDE_ANTHROPIC_KEY` is set and current at org level in RocketRide Variables. A stale key doesn't fail loudly (see below).
- [ ] Decide which org attendees deploy into, and that it has a developer id. Tell attendees the id: they pass it to `rocketride app create --developer`. To claim one live it must be empty: a sys.admin clears it in admin-ui → Orgs → the org → Edit → Developer Id.
- [ ] Every attendee account has a RocketRide Cloud subscription, and attendees did the guide's Set up at home step: editor and extensions, Python, Node, pnpm.
- [ ] Run the guide end to end yourself on the venue wifi, in a fresh folder: the three commands, Parts 1–3, the Preview, then Deploy and Publish. Time the cloud build.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `rocketride`: command not found | pip's scripts folder isn't on `PATH`. | Add the folder pip warned about to `PATH` and open a new terminal, or use `python -m rocketride.cli.main` in place of `rocketride` (same arguments). |
| pip can't install | No internet or a proxy; or `externally-managed-environment`, a system Python that won't take packages. | Switch networks; for `externally-managed-environment`, make a venv in the project folder, install there, and pick it as the notebooks' kernel. |
| The browser sign-in doesn't open, or init fails | `rocketride init` couldn't open a browser, or the sign-in didn't finish. | Open the link init prints by hand, or run `rocketride init --uri https://api.rocketride.ai` again. Without `--uri` it probes localhost. |
| `app create` fails on pnpm | pnpm (or Node) is missing, or the terminal predates the install. | `npm install -g pnpm@latest` (Node 20+ first), open a new terminal, run `app create` again. |
| App id is `local.specter-mutual`, or the App Builder shows a namespace banner | `app create` ran without `--developer`, or with the wrong id. The Deploy tab is read-only until the id matches. | Edit `appManifest.id` in `apps/specter-mutual/package.json` to `<developer id>.specter-mutual` and reopen the `.rrapp`, or delete the app folder and run `app create` again with `--developer`. |
| `No .env here` | The notebook isn't in the initialized project folder, or VS Code opened another folder. | Move the notebooks next to `.env`, open that folder with File → Open Folder, run the cell again. |
| `No module named 'rocketride'` in a notebook | The kernel is a different Python from the terminal's. | Pick the right Python in Select Kernel, or `pip install rocketride nbformat` for the kernel's Python. |
| Part 1: `No apps/specter-mutual/package.json` | `app create` didn't run, or ran in another folder. | Run it in the project folder's terminal, then Part 1 again. |
| Part 2: `The model sent back an error instead of an answer` | A bad, missing or stale Anthropic key. The run doesn't fail; the error text comes back as the answer. | Fix `ROCKETRIDE_ANTHROPIC_KEY` in Variables, run Part 2's Clean up (Variables are read when a task starts), then run the beat again. |
| One attendee still gets the key error with a valid org key | A user-level variable with the same name overrides the org-level one. | Fix or delete the attendee's user-level `ROCKETRIDE_ANTHROPIC_KEY`, then Clean up and retry. |
| Nothing reaches the agent, or the answer is empty | The claim was sent as `application/json`, which lands on another webhook lane. | The notebook sends `text/plain`. If someone edited `review()`, restore it, or run Part 2's skip-ahead. |
| "Pipeline is already running" | One task per user + pipeline; the notebook and the portal share it. | Everything attaches with `use_existing` / `useExisting`. If it persists, run Part 2's Clean up. |
| Beat 1 replies ignore the letter prompt | `llm_anthropic` has no system-prompt field, and the model often ignores the Prompt node. | Expected. It makes the point: a bare model sounds confident and decides nothing. Instructions arrive with the agent in beat 2. |
| SM-1006 never shows the coverage cap | The agent reads "up to $1,000" as a ceiling and denies the $2,400 Basic claim. | Expected. The cap shows in `policy.py`. |
| Part 3: `Missing apps/specter-mutual/package.json` or `pipelines/claims.pipe` | The app wasn't created, or Part 2 didn't finish. | Create the app (guide), or run Part 2's skip-ahead, then Part 3 again. |
| The Preview shows errors or stays blank | A file cell was edited, or the first `pnpm install` is still running. | Check the Design → Errors pane. Run Part 3's skip-ahead: it rewrites every file, and the Preview rebuilds on save. |
| The Preview loops on sign-in | Inherit Auth is off, or the editor's own session expired. | Check Inherit Auth in the Preview toolbar, then Reload; if it persists, sign out and back in to RocketRide in the editor. |
| pnpm: `ENOENT … .rocketride/client/rocketride.tgz` | The app's `file:` dependencies point at `.rocketride/`, which `init` and `app create` download. | Run `rocketride init --uri https://api.rocketride.ai` again in the project folder, then reopen the `.rrapp`. |
| Deploy: the version card shows **failed** | The source doesn't build on the server. | Click the failed badge for the build log; the reason is at the end. Run Part 3's skip-ahead, check the Preview, deploy again. |
| Published, but not on the desktop | The desktop picks up new apps on refresh. | Reload cloud.rocketride.ai. Check the Deploy tab's "Where this app is live" lists `@me`; if not, Publish to… → @me again. |
| The portal asks for an Anthropic key | No `ROCKETRIDE_ANTHROPIC_KEY` the portal's user can see. | Paste a key: the portal saves it to the user's Variables. |

## Why the policy engine sits outside the pipeline

Attendees ask why `policy.py` isn't a node. RocketRide has no Python node on the data lanes: `tool_python` is only reachable as an agent tool call. And a guardrail the agent controls is not a guardrail, which is the lesson of the module. So the pipeline returns the agent's recommendation, and the policy engine decides: `policy.py` in Part 2, its TypeScript twin `policy.ts` in the portal.

## Skip-ahead guide

Every part ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the part should have ended. None of them installs, scaffolds or deploys: if the app folder is missing, the attendee runs `rocketride app create` from the guide.

- **Part 1:** rewrites the manifest (`authenticated`, `include`).
- **Part 2:** writes both pipelines, the test claims and `policy.py`.
- **Part 3:** rewrites every portal file from the notebook's cells. The App Builder's Preview rebuilds on save.
- **Deploy:** no cell. If a deploy failed, read the build log from the failed badge, fix, and deploy again; to publish an older version, choose Publish to… → @me on its card.

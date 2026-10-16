# Facilitator notes: Specter Mutual

Operational notes for running this module. Time box: **40 minutes**.

## Run of show

| Guide step | Time | What happens | Where people fall behind |
| --- | --- | --- | --- |
| Start the project | 6 min (0:00) | In VS Code: make and open the folder, trust it, sign in with the RocketRide extension, App Builder → New App (`specter-mutual`, "Specter Mutual", Blank), then two find/replace edits in `apps/specter-mutual/package.json` | Untrusted folder (Restricted Mode, no RocketRide icon); pnpm missing so the wizard's install fails; replacing the top-level `"description"` instead of the one inside `appManifest`; a dropped comma. |
| Build the brain | 15 min (0:06) | New Pipeline (Webhook source) creates `pipelines/`, paste `claims.pipe` over it, add a Chat source wired to the agent, run, paste the six claims and the fraud claim one by one, then delete the Chat source and save | Chat wired into the Question box instead of the agent. A missing or stale `ROCKETRIDE_ANTHROPIC_KEY`: the answer *is* the error. Forgetting to delete the Chat source. Give the fraud test time; it's the point of the module. |
| Portal logic | 2 min (0:21) | Paste `policy.ts`, `claims.ts`, `apiKey.ts`, one section each |
| Theme integration | 2 min (0:23) | Paste `theme.ts`, `useSpecterTheme.ts` |
| Build the portal | 9 min (0:25) | One prompt builds the screens and runs `tsc`, then App Builder Design → Preview | Claude usually takes 3 to 6 minutes, and a slow run 15 to 20; talk through the table of pasted files meanwhile. The first Preview runs `pnpm install` and starts a dev server. |
| Deploy from the App Builder | 6 min (0:34) | Deploy → build ticker → Publish to… → @me, then file claims on cloud.rocketride.ai | The cloud build takes a minute or two. A namespace banner means the app id doesn't match the developer id. |

**What counts as done:** the portal is published to `@me`, opens on cloud.rocketride.ai and reviews a claim. The fraud test in Build the brain is the moment to stop and talk: the agent can be fooled, the policy engine can't.

Attendees do the setup and the deploy by hand, paste the files that must be exact (pipelines, policy engine, portal logic and theme), and use Claude Code for everything that's just glue or UI. The notebooks are a fallback only.

## The prompts

All are in the guide with Copy buttons; listed here so you know what to expect.

| Step | Prompt does | Expected result |
| --- | --- | --- |
| Chat test (no prompt) | Each claim pasted into the chat | SM-1001 approve, SM-1002 deny, SM-1003 deny, SM-1004 escalate, SM-1005 deny (late), SM-1006 deny or escalate (over the Basic limit). SM-1007 should be deny; if the agent approves it, that's the lesson: `policy.ts` in the portal overrides it |
| Portal | Builds `src/components/*` and `App.tsx` on the five pasted files, runs `pnpm exec tsc --noEmit` | Portal in the Preview; tsc clean |
| Fold: key fixed | Stops both running pipelines (`get_task_token` + `terminate`) | Next run restarts with the new key |
| Fold: namespace banner | Changes the developer id in `package.json`, `.rrapp`, `src/AppDescriptor.ts` | Deploy tab editable |

Claude's portal varies from run to run. The logic files are pasted, so decisions, payouts and policy overrides are always the reference behaviour; only the layout differs.

## Before the event

- [ ] `ROCKETRIDE_ANTHROPIC_KEY` is set and current at org level in RocketRide Variables. A stale key doesn't fail loudly (see below).
- [ ] Decide which org attendees deploy into, and that it has a developer id. The New App wizard builds every app id from it. To claim one live it must be empty: a sys.admin clears it in admin-ui → Orgs → the org → Edit → Developer Id.
- [ ] Every attendee account has a RocketRide Cloud subscription, and attendees did the guide's Set up at home step: editor and RocketRide extension, Python, Node, pnpm, and Claude Code signed in.
- [ ] Run the guide end to end yourself on the venue wifi, in a fresh folder: Start the project, the Build the brain chat test, the portal prompt, the Preview, then Deploy and Publish. Time Claude's portal build and the cloud build.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pip`: command not found | macOS has no bare `pip`. | `python3 -m pip install rocketride` (Windows: `python -m pip install rocketride`). |
| `rocketride`: command not found | pip's scripts folder isn't on `PATH`. | `python3 -m rocketride.cli.main` in place of `rocketride` (Windows: `python -m …`), same arguments. |
| pip can't install | No internet or a proxy; or `externally-managed-environment`, a system Python. | Switch networks; for `externally-managed-environment`, make a venv in the project folder and install there. |
| No RocketRide icon, or the App Builder won't open | The folder isn't trusted (Restricted Mode), or the extension isn't installed. | Status bar **Restricted Mode** → **Trust** → **Trust Folder and Continue**; install the extension; reload the window. |
| The wizard's package install fails | pnpm (or Node) missing, or VS Code started before it was installed. | `npm install -g pnpm@latest` (Node 20+ first), quit and reopen VS Code, `pnpm install` in the project folder. |
| `package.json` red squiggles after the manifest edit | A comma dropped, or the top-level `"description"` was replaced. | Compare with the full `appManifest` block in the guide. |
| `package.json` red squiggles after the manifest edit | Pasted over the wrong `"description"`, or a comma lost. | The snippet replaces the `"description"` line *inside* `appManifest`; each line there ends in a comma except the last. |
| App id is `local.specter-mutual`, or a namespace banner | `--developer` left out or wrong. The id is in `package.json`, `specter-mutual.rrapp` and `src/AppDescriptor.ts`. | Early: delete `apps/specter-mutual/` and recreate. Later: the guide's Deploy fold has a Claude prompt that changes all three. |
| Chat answers are `LLM error …` | A bad, missing or stale Anthropic key. The run doesn't fail; the error text comes back as the answer. | Fix `ROCKETRIDE_ANTHROPIC_KEY` in Variables, stop the pipeline in the editor and run it again (Variables are read when a task starts). |
| One attendee still gets the key error with a valid org key | A user-level variable with the same name overrides the org-level one. | Fix or delete the attendee's user-level `ROCKETRIDE_ANTHROPIC_KEY`, stop the pipelines, retry. |
| Claude's script can't import `rocketride` | Claude ran a different Python (`python` vs `python3`, or outside the venv). | Tell Claude which command works in the first terminal, or have it install `rocketride` for its Python. |
| Chat answers aren't JSON, or ignore the claim | The Chat source feeds the Question box, or only part of the claim was pasted. | Wire Chat's `questions` output to the agent's `questions` input; paste the whole box. |
| "Pipeline is already running" in the portal | The chat test's run is still going. | Stop the pipeline in the editor; the portal attaches with `useExisting` otherwise. |
| The portal never answers after the chat test | The Chat source wasn't deleted, or the file wasn't saved. | Delete the Chat box, save `claims.pipe`. |
| SM-1006 never shows the coverage cap | The agent reads "up to $1,000" as a ceiling and denies the $2,400 Basic claim. | Expected. The cap shows in the portal, where `policy.ts` decides. |
| Claude's portal fails `tsc` and can't fix it | Usually a pasted logic file got truncated, or Claude edited one. | Re-copy the five pasted files, ask Claude to run tsc again. Still stuck: the `03-ui-build.ipynb` fallback. |
| The App Builder won't open, `.rrapp` opens as text | Workspace not trusted: Restricted Mode turns the extension off. | Trust the folder (status bar or Workspaces: Manage Workspace Trust), reopen the `.rrapp`. |
| The Preview shows errors or stays blank | A compile error, or the first `pnpm install` still running. | Design → Errors pane; paste the error into Claude. |
| The Preview loops on sign-in | Inherit Auth is off, or the editor's own session expired. | Check Inherit Auth in the Preview toolbar, then Reload; if it persists, sign out and back in to RocketRide in the editor. |
| pnpm: `ENOENT … .rocketride/client/rocketride.tgz` | The app's `file:` dependencies point at `.rocketride/`, which the extension downloads when it connects. | Sign in again from the RocketRide panel, then reopen the `.rrapp`. |
| Deploy: the version card shows **failed** | The source doesn't build on the server (usually a type error). | Click the failed badge for the build log; paste the reason into Claude, check the Preview, deploy again. |
| Published, but not on the desktop | The desktop picks up new apps on refresh. | Reload cloud.rocketride.ai. Check the Deploy tab's "Where this app is live" lists `@me`; if not, Publish to… → @me again. |
| The portal asks for an Anthropic key | No `ROCKETRIDE_ANTHROPIC_KEY` the portal's user can see. | Paste a key: the portal saves it to the user's Variables. |

## Why the policy engine sits outside the pipeline

Attendees ask why `policy.py` isn't a node. RocketRide has no Python node on the data lanes: `tool_python` is only reachable as an agent tool call. And a guardrail the agent controls is not a guardrail, which is the lesson of the module. So the pipeline returns the agent's recommendation, and the policy engine decides: `policy.py` in Build the brain, its TypeScript twin `policy.ts` in the portal. That's also why both are pasted, never generated.

## Fallback guide

Each guide step has a **Stuck? Use the fallback** fold. Attendees download `specter-mutual.ipynb` plus the part, save both in the project folder, run `python3 -m pip install rocketride nbformat`, pick the Python they installed RocketRide into as the kernel, and run the cells in order. None of them installs, scaffolds or deploys: the app must exist from the New App wizard.

- **Start the project → `01-project-init.ipynb`:** writes the manifest (`authenticated`, `include`).
- **Build the brain → `02-pipeline-build.ipynb`:** writes the test claims, both pipelines and `policy.py`, runs the three beats and the fraud test. Its `# Skip ahead` cell only writes the files.
- **Build the portal → `03-ui-build.ipynb`:** writes the finished reference portal, replacing Claude's. The Preview rebuilds on save.
- **Deploy:** no notebook. Read the build log from the failed badge, fix with Claude, deploy again; to publish an older version, Publish to… → @me on its card.

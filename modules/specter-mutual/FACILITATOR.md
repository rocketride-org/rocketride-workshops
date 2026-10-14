# Facilitator notes: Specter Mutual

Operational notes for running this module. Time box: **40 minutes**.

## Run of show

| Part | Time | Where people fall behind |
| --- | --- | --- |
| Overview, Preflight, Config | 3 min | Node or pnpm missing. Preflight names the fix. |
| 1: Project init | 3 min | No developer id for the org (see below). The first scaffold downloads RocketRide's app packages and runs `pnpm install`. |
| 2: Pipeline build | 15 min | A missing or stale `ROCKETRIDE_ANTHROPIC_KEY`: the answer *is* the error. Give the fraud test time; it's the point of the module. |
| 3: UI build | 14 min | `pnpm install` on slow wifi. Running Part 3 before Part 2 finished (it stops and says so). |
| 4: Cloud deploy | 5 min | The cloud build takes a minute or two; have people watch the build steps print. |

**What counts as done:** the portal is published to `@me` and reviews a claim. Part 2's fraud test is the moment to stop and talk: the agent can be fooled, the policy engine can't.

## Before the event

- [ ] `ROCKETRIDE_ANTHROPIC_KEY` is set and current at org level in RocketRide Variables. A stale key doesn't fail loudly (see below).
- [ ] Decide which org attendees deploy into, and that it has a developer id. To claim one live it must be empty: a sys.admin clears it in admin-ui → Orgs → the org → Edit → Developer Id.
- [ ] Every attendee account has a RocketRide Cloud subscription.
- [ ] Run all five notebooks yourself on the venue wifi, and time the Part 4 cloud build.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Part 1: `Your organization has no developer id yet` | The org hasn't claimed one. | An org admin claims it in the App Builder's Deploy tab (letters and underscores). Then run the cell again: it reconnects and picks it up. |
| Part 2: `The model sent back an error instead of an answer` | A bad, missing or stale Anthropic key. The run doesn't fail; the error text comes back as the answer. | Fix `ROCKETRIDE_ANTHROPIC_KEY` in Variables, run Part 2's Clean up (Variables are read when a task starts), then run the beat again. |
| One attendee still gets the key error with a valid org key | A user-level variable with the same name overrides the org-level one. | Fix or delete the attendee's user-level `ROCKETRIDE_ANTHROPIC_KEY`, then Clean up and retry. |
| Nothing reaches the agent, or the answer is empty | The claim was sent as `application/json`, which lands on another webhook lane. | The notebook sends `text/plain`. If someone edited `review()`, restore it, or run Part 2's skip-ahead. |
| "Pipeline is already running" | One task per user + pipeline; the notebook and the portal share it. | Everything attaches with `use_existing` / `useExisting`. If it persists, run Part 2's Clean up. |
| Beat 1 replies ignore the letter prompt | `llm_anthropic` has no system-prompt field, and the model often ignores the Prompt node. | Expected. It makes the point: a bare model sounds confident and decides nothing. Instructions arrive with the agent in beat 2. |
| SM-1006 never shows the coverage cap | The agent reads "up to $1,000" as a ceiling and denies the $2,400 Basic claim. | Expected. The cap shows in `policy.py`. |
| Part 3: `Missing apps/specter-mutual/package.json` or `pipelines/claims.pipe` | Part 1 or 2 didn't finish. | Run that part's skip-ahead cell, then Part 3 again. |
| Part 3: `pnpm build` type errors | A file cell was edited. | Run Part 3's skip-ahead: it rewrites every file from the notebook and builds. |
| pnpm: `ENOENT … .rocketride/client/rocketride.tgz` | An app workspace's `file:` dependencies point at `.rocketride/`, which Part 1 downloads. | Run Part 1 again (or its skip-ahead): `create_app` downloads the packages and installs. |
| Part 4: `The cloud build of vN failed` | The source doesn't build on the server. | Read the build log the cell prints. A clean Part 3 build passes in the cloud too; run Part 3's skip-ahead and deploy again. |
| Part 4: `vN is still building` | The cloud build took longer than five minutes. | Wait a minute, then run Part 4's skip-ahead: it publishes the newest finished version. |
| The portal asks for an Anthropic key | No `ROCKETRIDE_ANTHROPIC_KEY` the portal's user can see. | Paste a key: the portal saves it to the user's Variables. |
| `No module named 'rocketride'` after Preflight | The SDK was updated while it was already imported. | Restart the kernel, then run the notebook again. |
| The Config cell keeps asking for the key | No `ROCKETRIDE_APIKEY` in the environment or a `.env` next to the notebooks. | Paste the key when asked; it's kept for the session. Each part loads Config again, so a `.env` saves retyping. |

## Why the policy engine sits outside the pipeline

Attendees ask why `policy.py` isn't a node. RocketRide has no Python node on the data lanes: `tool_python` is only reachable as an agent tool call. And a guardrail the agent controls is not a guardrail, which is the lesson of the module. So the pipeline returns the agent's recommendation, and the policy engine decides: `policy.py` in Part 2, its TypeScript twin `policy.ts` in the portal.

## Skip-ahead guide

Every part ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the part should have ended.

- **Part 1:** starts the app over from a clean template and writes the manifest.
- **Part 2:** writes both pipelines, the test claims and `policy.py`.
- **Part 3:** rewrites every portal file from the notebook's cells and builds.
- **Part 4:** publishes the newest version that finished building.

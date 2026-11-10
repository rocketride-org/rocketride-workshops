# Facilitator notes: Give Excalidraw a diagram agent

Operational notes for running this module. Time box: **15 minutes in the room** (Steps 5–7). The hour ends with 3 minutes of feedback after Specter Mutual (0:57): see its FACILITATOR notes. Steps 2–4 (setup, the ~900 MB clone and install, sign-in and `.env`) must be done at home: on venue wifi the download alone can take 15 minutes or more. The module is guide-only: attendees type every command and paste every file from the guide. Expect people who have never used a terminal.

## Run of show

| Guide step                | Time    | Where people fall behind                                                                                                      |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2–4. At home              | —       | Didn't do them. Clone with `--filter=blob:none` or hand over the USB copy; the `yarn workspace` install still needs the network. `rocketride login` run outside `excalidraw`, so `.env` lands in the wrong folder. The two `VITE_APP_` lines missing from `.env`. |
| 5. Add the diagram agent  | 8 min   | Prompt tab takes 5–8 minutes; anyone without Claude Code (Pro/Max or Console account) or a coding agent, or running late, goes to the Files tab. Files created outside `excalidraw-app/components`, or `pipelines` not at the repo root. `AppSidebar.tsx` pasted without replacing everything. Unsaved tabs. |
| 6. Deploy the agent       | 2 min   | Terminal not in `excalidraw`. Workshop code not redeemed (plan error).                                                        |
| 7. Try it                 | 5 min   | A missing or wrong `ROCKETRIDE_ANTHROPIC_KEY` variable. `.env` edited while `yarn start` was running. Not finding the brain: it's behind the **Library** button at the top right. |

## Before the event

- [ ] Do the whole guide yourself on the venue wifi, in a fresh folder, pasting from the published page. Time the first answer to the repo message in Step 7.
- [ ] Confirm the pipeline runs on RocketRide Cloud as written and that `answers` comes back as Mermaid text the panel draws. This was never run live when the module was written.
- [ ] Test GitHub limits with a room-sized burst: have a few people (or a script) send the Step 7 message at once. Every agent's reads leave from RocketRide Cloud's shared outbound address, so the whole room shares one GitHub allowance.
- [ ] Run the Step 5 prompt in at least one coding agent attendees are likely to use, and check that Step 7 works with what it writes.
- [ ] Prepare a USB copy of a cloned `excalidraw` folder at `701b901` for people who didn't clone at home.
- [ ] Remind attendees to do Steps 2–4 at home: Yarn and git installed, a RocketRide Cloud account with the workshop code redeemed, an Anthropic API key with credit saved under **Settings → Environment Variables** as `ROCKETRIDE_ANTHROPIC_KEY`, Excalidraw cloned and installed, and `npx rocketride login` run with the two `VITE_APP_` lines added to `.env`.

The pipeline's `project_id` (`dafb1567-0f6e-4b87-a00e-74ce8bef1db7`) is hard-coded in the guide. That's fine: every attendee's account is its own organization (no shared workshop org), so each deploys it into their own org.

## Troubleshooting

| Symptom                                                                  | Cause                                                                                     | Fix                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `git`, `yarn` or `node`: command not found                               | Not installed, or the terminal started before it was.                                     | Install it (`npm install -g yarn` for Yarn), then open a new terminal.                                      |
| `pathspec '701b901' did not match`                                       | The clone didn't finish.                                                                  | Delete the `excalidraw` folder and run the clone, `cd excalidraw` and `git checkout 701b901` again.         |
| `Unknown workspace "excalidraw-app"` or `Cannot find the root of your workspace` | The terminal isn't in `excalidraw`.                                               | `cd excalidraw` and run the `yarn workspace` command again.                                                 |
| `Thanks for signing up` / `access queue` at sign-in, or a plan/subscription/credits error at deploy | The workshop code isn't redeemed.                               | Redeem it in the **Have a promo code?** bar at the bottom of the desktop at cloud.rocketride.ai, then rerun. |
| Red squiggles in a pasted file                                           | A partial paste, or a paste into the wrong file.                                          | Select all in that file, copy its box again, paste over.                                                    |
| The coding agent's files fail in Step 7                                  | The agent wrote something different from the reference.                                  | Open each file and paste its Files-tab box over everything in it.                                          |
| Chat says `Your pipeline is not running` after a successful deploy       | The coding agent looked up the first team (Production) instead of `devTeam`.              | In `diagramAgent.ts`, set `teamId` to `client.getAccountInfo()?.devTeam`, save, send again.                |
| No brain in the sidebar, or `No matching export ... "AppSidebar"`        | `AppSidebar.tsx` not replaced, or replaced with another box.                              | Paste the File 5 box over everything in `AppSidebar.tsx`, save; restart `yarn start` if the error stays.    |
| Red squiggle only on the `"rocketride"` import                           | The install didn't finish.                                                                | Run `yarn workspace excalidraw-app add rocketride@1.6.0` again.                                             |
| `LLM error` or `invalid x-api-key` in the chat                           | The `ROCKETRIDE_ANTHROPIC_KEY` variable in RocketRide Cloud is missing or wrong, or the Anthropic account has no credit. | Fix it under **Settings → Environment Variables**, run both Step 6 commands again so the agent restarts with it, send again. |
| Any other `RocketRide error: ...` in the chat                            | The `VITE_APP_` lines are missing from `.env`, or it changed after `yarn start`.          | Check `.env` sits next to `package.json` and ends with both `VITE_APP_` lines, save, Ctrl+C, `yarn start`.  |
| `Mermaid syntax error` or an invalid diagram                             | The agent wrote Mermaid that can't be parsed.                                             | Click **Regenerate (auto-fix)**, or reply "That diagram has a syntax error, fix it".                        |
| Red error overlay or a blank page                                        | A pasted file has an error.                                                               | The overlay or terminal names the file; re-copy that file's box.                                            |
| Port 3001 busy                                                           | Something else is on it.                                                                  | Vite moves to the next port and prints it; open that URL.                                                   |

## Getting someone unstuck fast

In `excalidraw`:

```sh
git checkout -- excalidraw-app/components/AppSidebar.tsx
```

Then delete `excalidraw-app/components/diagramAgent.ts`, `DiagramAgentPanel.tsx`, `DiagramAgentPanel.scss` (all in `excalidraw-app/components`) and the `pipelines` folder, and redo Steps 5 and 6 from the published page's Files tab. Their `.env` and installed packages are untouched, so `yarn start` works straight after.

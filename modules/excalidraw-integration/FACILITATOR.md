# Facilitator notes: Give Excalidraw a diagram agent

Operational notes for running this module. Time box: **15 minutes**. The module is guide-only: attendees type every command and paste every file from the guide. Expect people who have never used a terminal.

## Run of show

| Guide step                | Time  | Where people fall behind                                                                                                      |
| ------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| 3. Get the app            | 2 min | A clone cut short on slow wifi. Not opening `excalidraw` in the editor, so the Explorer shows the wrong folder.               |
| 4. Connect RocketRide     | 3 min | The file named `.env` instead of `.env.local`, or saved inside `excalidraw-app`. The ~900 MB install on venue wifi.           |
| 5. Add the diagram agent  | 5 min | No coding agent set up, so time lost on the Prompt tab: send them to the file tabs. `diagramAgent.ts` created outside `excalidraw-app/components`. `AI.tsx` pasted without replacing everything. Unsaved tabs. |
| 6. Run it                 | 5 min | A wrong `VITE_ROCKETRIDE_ANTHROPIC_KEY`. `.env.local` edited while `yarn start` was running. Not finding **More tools**.       |

## Before the event

- [ ] Do the whole guide yourself on the venue wifi, in a fresh folder, pasting from the published page. Time the first answer to the repo message in Step 6.
- [ ] Confirm the pipeline runs on RocketRide Cloud as written and that `answers` comes back as Mermaid text the dialog draws. This was never run live when the module was written.
- [ ] Test GitHub limits with a room-sized burst: have a few people (or a script) send the Step 6 message at once. Every agent's reads leave from RocketRide Cloud's shared outbound address, so the whole room shares one GitHub allowance.
- [ ] Run the Step 5 prompt in at least one coding agent attendees are likely to use, and check that Step 6 works with what it writes.
- [ ] Tell attendees on slow connections to do Step 3 and the Step 4 install at home.
- [ ] Attendees have a RocketRide Cloud account and API key, an Anthropic API key, and installed Node 20+, Yarn 1 and git at home. The app sends the Anthropic key from `.env.local`, so RocketRide Variables aren't used.

## Troubleshooting

| Symptom                                                                  | Cause                                                                                     | Fix                                                                                                         |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `git`, `yarn` or `node`: command not found                               | Not installed, or the editor started before it was.                                       | Install it (`npm install -g yarn` for Yarn), then restart the editor.                                       |
| `pathspec '701b901' did not match`                                       | The clone didn't finish.                                                                  | Delete the `excalidraw` folder and run the three clone lines again.                                         |
| `Unknown workspace "excalidraw-app"` or `Cannot find the root of your workspace` | The terminal isn't in `excalidraw`.                                               | `cd excalidraw` and run the `yarn workspace` command again.                                                 |
| Red squiggles in a pasted file                                           | A partial paste, or a paste into the wrong file.                                          | Select all in that file, copy its box again, paste over.                                                    |
| The coding agent's files fail in Step 6                                  | The agent wrote something different from the reference.                                  | Paste the **diagramAgent.ts** and **AI.tsx** tabs over its files.                                           |
| Red squiggle only on the `"rocketride"` import                           | The install didn't finish.                                                                | Run `yarn workspace excalidraw-app add rocketride@1.4.0` again.                                             |
| `Invalid Anthropic API key format` or `invalid x-api-key` in the chat    | `VITE_ROCKETRIDE_ANTHROPIC_KEY` in `.env.local` is empty or wrong.                        | Fix the line, save, Ctrl+C, `yarn start`. Send again; a second try if the first shows the old error.        |
| Any other `RocketRide error: ...` in the chat                            | A key line is empty or wrong, the file is named `.env`, or it changed after `yarn start`. | Check the file is `.env.local` next to `package.json`, fix the keys, save, Ctrl+C and `yarn start` again.  |
| `Generated an invalid diagram` or `Mermaid syntax error`                 | The agent wrote Mermaid the dialog can't parse.                                           | Reply "That diagram has a syntax error, fix it".                                                            |
| Red error overlay or a blank page                                        | A pasted file has an error.                                                               | The overlay or terminal names the file; re-copy that file's box.                                            |
| Port 3001 busy                                                           | Something else is on it.                                                                  | Vite moves to the next port and prints it; open that URL.                                                   |

## Getting someone unstuck fast

In `excalidraw`:

```sh
git checkout -- excalidraw-app/components/AI.tsx
```

Then delete `excalidraw-app/components/diagramAgent.ts` and redo Step 5 from the published page. Their `.env.local` and installed packages are untouched, so `yarn start` works straight after.

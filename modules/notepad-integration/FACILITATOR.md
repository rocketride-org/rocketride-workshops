# Facilitator notes: Integrate RocketRide into an existing app

Operational notes for running this module. Time box: **15 minutes**. The module is guide-only: attendees type every command and paste every file from the guide. Expect people who have never used a terminal.

## Run of show

| Guide step              | Time  | Where people fall behind                                                                                     |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| 3. Get the app          | 2 min | Not opening `notepad-starter` in the editor, so the Explorer shows the wrong folder.                          |
| 4. Connect RocketRide   | 3 min | `.env` inside `src`. A key line left as a placeholder. A UTF-16 `.env` from PowerShell. `pnpm add` on slow wifi. |
| 5. Add the Assist button | 5 min | `assist.ts` created outside `src`. `main.ts` pasted without replacing everything. Unsaved tabs.               |
| 6. Run it               | 5 min | A missing or wrong `VITE_ROCKETRIDE_ANTHROPIC_KEY` in `.env`. `.env` edited while `pnpm dev` was running. |

## Before the event

- [ ] Attendees have a RocketRide Cloud account and API key, an Anthropic API key, and installed Python, Node, pnpm and git at home. The app sends the Anthropic key from `.env`, so RocketRide Variables aren't used.
- [ ] `https://github.com/rocketride-org/notepad-starter` is reachable from the venue network, with both `main` and `integrated` branches.
- [ ] Do the whole guide yourself on the venue wifi, in a fresh folder, pasting from the published page.

## Troubleshooting

| Symptom                                                   | Cause                                                                                   | Fix                                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `git`, `pnpm` or `node`: command not found                | Not installed, or the editor started before it was.                                     | Install it, then restart the editor.                                                                        |
| `rocketride: command not found`                           | pip's scripts folder isn't on `PATH`.                                                   | `python3 -m rocketride.cli.main init` (Windows: `python`, or `py`).                                         |
| `rocketride init`: `Error: No authorization provided`     | No key found. rocketride 1.4.0 can't sign in through the browser, so `.env` is required. | Check `.env` is in `notepad-starter` itself, `ROCKETRIDE_APIKEY` is filled in, and the file is saved.        |
| `UnicodeDecodeError` ... `byte 0xff`                      | `.env` was made with `echo ... > .env` in PowerShell (UTF-16).                          | Status bar **UTF-16 LE** → **Save with Encoding** → **UTF-8**, or recreate it with **New File**.            |
| Red squiggles in a pasted file                            | A partial paste, or a paste into the wrong file.                                        | Select all in that file, copy its box again, paste over.                                                    |
| `Invalid Anthropic API key format` or `invalid x-api-key` | `VITE_ROCKETRIDE_ANTHROPIC_KEY` in `.env` is empty or wrong.                            | Fix the line, save, Ctrl+C, `pnpm dev`. Press Assist; a second press if the first shows the old error.      |
| Any other `RocketRide error: ...` under the editor        | The `VITE_` key lines are empty or wrong, or `.env` changed after `pnpm dev` started.   | Fix both `VITE_` lines, save, Ctrl+C and `pnpm dev` again.                                                  |
| No Assist button                                          | `src/main.ts` wasn't replaced or saved.                                                 | Redo build step 2, save, reload the page.                                                                   |
| Blank page                                                | A file has an error.                                                                    | `pnpm build` names the file and line; re-copy that file's box.                                              |
| Port 5173 busy                                            | Something else is on it.                                                                | Vite moves to the next port and prints it; open that URL.                                                   |

## Getting someone unstuck fast

The starter's `integrated` branch has the same integration, split across more files. In `notepad-starter`:

```sh
git fetch origin integrated
git checkout origin/integrated -- package.json pnpm-lock.yaml tsconfig.json src
pnpm install
pnpm dev
```

Their `.env` is untouched. The branch still reads the Anthropic key from RocketRide Variables, so add `ROCKETRIDE_ANTHROPIC_KEY: import.meta.env.VITE_ROCKETRIDE_ANTHROPIC_KEY ?? ''` to the `env` in `src/rocketride.ts` before `pnpm dev`. (Their own `src/assist.ts` is overwritten by the branch's version, which imports `rocketride.ts` and `assist-pipeline.json`; both come with the checkout.)

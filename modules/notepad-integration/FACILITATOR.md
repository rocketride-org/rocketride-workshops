# Facilitator notes: Integrate RocketRide into an existing app

Operational notes for running this module. Time box: **15 minutes**.

Attendees do all setup and installs by hand in a terminal, following the guide's **Start the project** step. The notebook only connects, writes files and runs the pipeline.

## Run of show

| Step                                     | Where  | Time  | Where people fall behind                               |
| ---------------------------------------- | ------ | ----- | ------------------------------------------------------ |
| Start the project: `pip install rocketride`, `rocketride init`, `git clone`, `pnpm install --ignore-workspace`, `pnpm dev` | Terminal | 4 min | The first browser sign-in; `rocketride` not on PATH; `pnpm install` on slow wifi; port 5173 already in use. |
| Stage 1: Connect                         | Notebook | 1 min | Notebook saved outside the project folder (no `.env`); kernel is a different Python from the one `pip` used. |
| Stage 2: Add the RocketRide client       | Terminal + notebook | 5 min | `pnpm add` on slow wifi; forgetting to restart `pnpm dev` after `.env.local` is written. |
| Stage 3: Call your pipeline from the app | Notebook | 5 min | A missing or stale `ROCKETRIDE_ANTHROPIC_KEY` in Variables (the answer *is* the error); a stale browser tab. |

## Before the event

- [ ] `ROCKETRIDE_ANTHROPIC_KEY` is set and current at org level in RocketRide Variables. The Summarize pipeline reads it on the server. A stale key doesn't fail loudly (see below).
- [ ] Attendees have a RocketRide Cloud account and did the guide's **Start the project** step once at home, so the downloads are cached.
- [ ] `https://github.com/rocketride-org/notepad-starter` is reachable from the venue network, with both `main` and `integrated` branches.
- [ ] Run the guide's commands and the notebook top to bottom yourself on the venue wifi.

## Troubleshooting

| Symptom                                                        | Cause                                                                                                       | Fix                                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The answer text says `LLM error …`                             | The model key is bad, missing or stale. A bad key doesn't fail the run; the error comes back as the answer. | Fix the model key in the RocketRide sidebar under account menu → Variables, then stop the running task and start it again.                |
| "Pipeline is already running"                                  | There is one task per user + pipeline. An earlier run, or another cell, still owns it.                      | The notebook and the app both attach with `use_existing`/`useExisting`. If it still appears, run Clean up, or stop the task in the RocketRide sidebar. |
| A key or variable change has no effect                         | Variables are read when the task starts, not on each run.                                                   | Stop the running task and start it again after any Variables change.                                                                      |
| One attendee still fails with a valid org key                  | A user-level variable with the same name overrides the org-level one.                                       | Fix or delete the attendee's user-level variable, then restart the task.                                                                  |
| `pip install rocketride` fails                                 | No internet or a proxy; or `externally-managed-environment`, a system Python that won't take packages.     | Switch networks. For `externally-managed-environment`, make a venv (`python3 -m venv .venv`), activate it, install there, and pick it in Select Kernel. |
| `rocketride: command not found`                                | pip's `Scripts` (Windows) or `bin` folder isn't on PATH.                                                    | Run `python -m rocketride.cli.main init --uri https://api.rocketride.ai` instead; it works the same.                                      |
| The browser sign-in doesn't open, or init fails                | `rocketride init` couldn't open a browser, or the sign-in didn't finish.                                    | Copy the sign-in link it prints into a browser, or run `rocketride init --uri https://api.rocketride.ai` again in the project folder.      |
| Connect: `No .env here`                                        | The notebook isn't in the initialized project folder.                                                       | Save the notebook next to `.env` and `notepad-starter/`, open it from there, rerun the Connect cell.                                      |
| Connect: `No module named 'rocketride'`                        | The kernel is a different Python from the one `pip install rocketride` used.                                | Pick the matching Python in Select Kernel, or `pip install rocketride` for the kernel's Python.                                           |
| Connect: `Invalid or expired access_token`                     | The key init saved in `.env` was revoked.                                                                   | Run `rocketride init --uri https://api.rocketride.ai` again in the project folder, restart the kernel, rerun Connect.                     |
| VS Code asks to install `ipykernel`, or the kernel won't start | The selected interpreter has no `ipykernel`.                                                                | Accept the prompt, or run `python3 -m pip install ipykernel` for that interpreter.                                                        |
| `pnpm`, `node` or `git`: command not found                     | The tool is missing, or the editor was open when it was installed.                                          | Install it (`npm install -g pnpm@latest` for pnpm), then restart the editor so its terminals see the new PATH.                            |
| `git clone` fails                                              | No network access to GitHub, or git isn't installed.                                                        | Check `git --version` and the network. As a fallback, hand out a zip of `notepad-starter` to unzip into the project folder.               |
| `pnpm install` fails or hangs                                  | Slow or filtered network, or a stale package store.                                                         | Rerun it. If it still fails, run `pnpm store prune`, then `pnpm install --ignore-workspace` again.                                        |
| pnpm: `ENOENT … .rocketride/client/rocketride.tgz`             | A `pnpm-workspace.yaml` in a parent folder (the RocketRide extension creates one) overrides `rocketride` with a local file. | Run the pnpm command with `--ignore-workspace`, as the guide shows.                                                     |
| `pnpm dev` says port 5173 is in use                            | Another dev server, or a previous run, holds port 5173.                                                     | Ctrl+C the other dev server (or close its terminal), then run `pnpm dev --host 127.0.0.1 --port 5173 --strictPort` again.                 |
| The app doesn't change after a `%%writefile` cell              | The dev server stopped, or the browser tab is stale.                                                        | Check the `pnpm dev` terminal; start it again if needed and reload http://127.0.0.1:5173.                                                 |
| The app shows `RocketRide error: …` when Assist is pressed      | `.env.local` is missing, or `pnpm dev` started before it existed and never read it.                         | Rerun the Stage 2 key cell, restart `pnpm dev` (Ctrl+C, run it again), then reload the page.                                              |
| The notebook's sample works, the app says the key is missing    | The model key is only in the attendee's local environment, not in RocketRide Variables. The browser sends no model key. | Set `ROCKETRIDE_ANTHROPIC_KEY` in Variables, then stop the task (Clean up) and press Assist again.                                         |

## Skip-ahead guide

Stages 2 and 3 end with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the stage should have ended, so they can carry on with the next stage. The cells only restore files with `git checkout`; reinstalling is done by hand.

- **Stuck in Start the project or Stage 1:** there is no skip-ahead; fix the setup with the troubleshooting table. To reset a broken clone to the plain starter, in `notepad-starter`: `git checkout origin/main -- .` then `pnpm install --ignore-workspace`.
- **Stuck in Stage 2:** run the Stage 2 skip-ahead cell. It checks out the finished client files from the `integrated` branch and writes `.env.local`. Then, in `notepad-starter`, run `pnpm install --ignore-workspace` and restart `pnpm dev`.
- **Stuck in Stage 3:** run the Stage 3 skip-ahead cell. It checks out the finished feature from the `integrated` branch: `src/assist-pipeline.json`, `src/assist.ts`, the button in `src/main.ts`, and `tsconfig.json`.

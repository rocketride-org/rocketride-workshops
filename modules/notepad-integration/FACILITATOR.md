# Facilitator notes: Integrate RocketRide into an existing app

Operational notes for running this module. Time box: **15 minutes**.

## Run of show

| Stage                                    | Time  | Where people fall behind                               |
| ---------------------------------------- | ----- | ------------------------------------------------------ |
| Preflight, Config, Connect               | 2 min | Node and pnpm versions. Preflight names the fix.       |
| Stage 1: Get the notepad running         | 3 min | `pnpm install` on slow wifi; port 5173 already in use. |
| Stage 2: Add the RocketRide client       | 5 min | TODO(joshua)                                           |
| Stage 3: Call your pipeline from the app | 5 min | TODO(joshua)                                           |

## Before the event

- [ ] The org-level model API key in RocketRide Variables is current. A stale key doesn't fail loudly (see below).
- [ ] Attendees ran this notebook's Preflight cell at home and saw `ready`.
- [ ] `https://github.com/rocketride-org/notepad-starter` is reachable from the venue network, with both `main` and `integrated` branches.
- [ ] Run the notebook top to bottom yourself on the venue wifi.

## Troubleshooting

| Symptom                                                        | Cause                                                                                                       | Fix                                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The answer text says `LLM error …`                             | The model key is bad, missing or stale. A bad key doesn't fail the run; the error comes back as the answer. | Fix the model key in the RocketRide sidebar under account menu → Variables, then stop the running task and start it again.                |
| "Pipeline is already running"                                  | There is one task per user + pipeline. An earlier run, or another cell, still owns it.                      | Use the Connect cell's `start()`, which attaches to the running task. Or stop the task in the RocketRide sidebar.                         |
| A key or variable change has no effect                         | Variables are read when the task starts, not on each run.                                                   | Stop the running task and start it again after any Variables change.                                                                      |
| One attendee still fails with a valid org key                  | A user-level variable with the same name overrides the org-level one.                                       | Fix or delete the attendee's user-level variable, then restart the task.                                                                  |
| `No module named 'rocketride'`                                 | The notebook's kernel is a different Python from the one `rocketride` was installed into.                   | Select Kernel → Python Environments → the right interpreter. Or run `%pip install rocketride ipykernel` in a cell and restart the kernel. |
| VS Code asks to install `ipykernel`, or the kernel won't start | The selected interpreter has no `ipykernel`.                                                                | Accept the prompt, or run `python3 -m pip install ipykernel` for that interpreter.                                                        |
| Preflight: `Can't reach api.rocketride.ai`                     | No internet, or a VPN or proxy blocks it.                                                                   | Switch networks or turn off the VPN, then rerun Preflight. On venue wifi, try a phone hotspot.                                            |
| The Config cell keeps asking for the key                       | No `ROCKETRIDE_APIKEY` in the environment or in a `.env` next to the notebook.                              | Paste the key when asked; it's kept for the session. To skip the prompt, create the `.env` described in SETUP.md.                         |
| Preflight: `pnpm` missing or too old                           | pnpm isn't installed, or it's older than 10.                                                                | `npm install -g pnpm@latest`, then restart VS Code so the kernel sees the new PATH.                                                       |
| `git clone` fails                                              | No network access to GitHub, or git isn't installed.                                                        | Check `git --version` and the network. As a fallback, hand out a zip of `notepad-starter` and unzip it next to the notebook.              |
| `pnpm install` fails or hangs                                  | Slow or filtered network, or a stale package store.                                                         | Rerun the cell. If it still fails, run `pnpm store prune` in a terminal, then rerun.                                                      |
| Notepad says `did not start`, or port 5173 is in use           | Another dev server, or a previous run, holds port 5173.                                                     | Run the Clean up cell, or stop whatever owns port 5173, then rerun the start cell.                                                        |
| The app doesn't change after a `%%writefile` cell              | The dev server isn't running, or the browser tab is stale.                                                  | Rerun the start cell and reload http://127.0.0.1:5173.                                                                                    |

## Skip-ahead guide

Every stage ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the stage should have ended, so they can carry on with the next stage.

- **Stuck in Stage 1:** point them to the `# Skip ahead` cell at the end of Stage 1. It resets the app to the plain starter (`main`) and reinstalls. Then rerun the start cell.
- **Stuck in Stage 2:** point them to the `# Skip ahead` cell at the end of Stage 2. It checks out the finished client files from the `integrated` branch.
- **Stuck in Stage 3:** point them to the `# Skip ahead` cell at the end of Stage 3. It checks out the finished feature from the `integrated` branch.

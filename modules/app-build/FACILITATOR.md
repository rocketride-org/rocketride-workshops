# Facilitator notes: Build and deploy an app

Operational notes for running this module. Time box: **40 minutes**.

## Run of show

| Stage                      | Time   | Where people fall behind                           |
| -------------------------- | ------ | -------------------------------------------------- |
| Preflight, Config, Connect | 2 min  | No Cloud subscription: the deploy will fail later. |
| Stage 1                    | 10 min | TODO(joshua)                                       |
| Stage 2                    | 10 min | TODO(joshua)                                       |
| Stage 3                    | 10 min | TODO(joshua)                                       |
| Stage 4                    | 5 min  | TODO(joshua)                                       |
| Deploy                     | 3 min  | Slow venue wifi. Have a backup deployment ready.   |

## Before the event

- [ ] The org-level model API key in RocketRide Variables is current. A stale key doesn't fail loudly (see below).
- [ ] Attendees ran this notebook's Preflight cell at home and saw `ready`.
- [ ] Test a deploy from the notebook on the venue wifi, and keep a backup deployment ready.
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

## Skip-ahead guide

Every stage ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the stage should have ended, so they can carry on with the next stage.

- **Stuck in Stage 1:** point them to the `# Skip ahead` cell at the end of Stage 1. It writes the finished stage 1 artifact to `build/`.
- **Stuck in Stage 2:** point them to the `# Skip ahead` cell at the end of Stage 2. It writes the finished stage 2 artifact to `build/`.
- **Stuck in Stage 3:** point them to the `# Skip ahead` cell at the end of Stage 3. It writes the finished stage 3 artifact to `build/`.
- **Stuck in Stage 4:** point them to the `# Skip ahead` cell at the end of Stage 4. It writes the finished stage 4 artifact to `build/`.

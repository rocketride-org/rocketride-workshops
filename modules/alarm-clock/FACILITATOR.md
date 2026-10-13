# Facilitator notes: Alarm clock

Operational notes for running this module. Time box: **5 minutes**.

## Run of show

| Stage                       | Time     | Where people fall behind                                           |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| Preflight, Config, Connect  | 1 min    | Anyone who skipped SETUP.md. Send them to the kernel picker first. |
| Stage 1: Build the drop zone | 1 min   | Rarely. It only writes a file.                                     |
| Stage 2: Drop a file        | 2 min    | First start of the pipeline is slow. Have them wait, then re-run.  |
| Set the alarm               | 1 min    | No Prod team, or no permission to deploy to it. See below.         |

## Before the event

- [ ] The org-level model API key in RocketRide Variables is current. A stale key doesn't fail loudly (see below).
- [ ] Attendees ran this notebook's Preflight cell at home and saw `ready`.
- [ ] Attendees have a team called Prod they can deploy to, or know which team to put in `TEAM_NAME`.
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
| Set the alarm: `No team called "Prod"`                        | The org has no team with that name, or the attendee isn't in it.                                            | Set `TEAM_NAME` to one of the teams the error lists, or have an org admin create a Prod team and add them.                                |
| Set the alarm fails on publish or deploy                       | No active subscription, or no permission to deploy to that team.                                            | Check the subscription, and the attendee's role on the team.                                                                             |
| Wake times are an hour off                                     | The cell converts local time with today's UTC offset; the clocks have changed since.                        | Run the Set the alarm cell again.                                                                                                         |
| `Text back:` is empty                                          | The file had no text to find: a photo with no writing, a video with no speech.                              | Try a document or a screenshot of text.                                                                                                   |
| The Config cell keeps asking for the key                       | No `ROCKETRIDE_APIKEY` in the environment or in a `.env` next to the notebook.                              | Paste the key when asked; it's kept for the session. To skip the prompt, create the `.env` described in SETUP.md.                         |

## Skip-ahead guide

Every stage ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the stage should have ended, so they can carry on with the next stage.

- **Stuck in Stage 1:** point them to the `# Skip ahead` cell at the end of Stage 1. It writes the finished pipeline to `build/`.
- **Stuck in Stage 2:** point them to the `# Skip ahead` cell at the end of Stage 2. It stops any stuck copy of the pipeline and starts a fresh one.

# Facilitator notes: Alarm clock

Operational notes for running this module. Time box: **5 minutes**.

## Run of show

| Stage                         | Time  | Where people fall behind                                                     |
| ----------------------------- | ----- | ---------------------------------------------------------------------------- |
| Setup, Config, Connect        | 1 min | First run installs the SDK (about a minute). Anyone with the wrong kernel.   |
| Stage 1: Create the app       | 1 min | No developer id for the org. See below.                                      |
| Stage 2: Draw the clock       | 1 min | Rarely. It only writes two files.                                            |
| Stage 3: Deploy and open it   | 2 min | The cloud build takes a minute or two. Have them watch the build steps print. |

## Before the event

- [ ] Decide which org attendees deploy into, and whether it has a developer id. To claim one live, it must be empty.
- [ ] To clear a developer id: a sys.admin opens admin-ui → Orgs → the org → Edit, clears **Developer Id** and saves. Users can't rename or remove a claimed id themselves.
- [ ] Run the notebook top to bottom yourself on the venue wifi, and time the Stage 3 build.
- [ ] Open the printed link and check the clock ticks and the alarm rings.

## Claiming a developer id live

1. An org admin opens the RocketRide App Builder in VS Code and goes to the **Deploy** tab.
2. The registration banner asks for a developer id: letters and underscores only, for example `acme_labs`. `local` and `rocketride` are taken.
3. Click **Register**. Each org can claim only one id, and it can't be changed afterwards without a sys.admin.
4. Back in the notebook, run Stage 1 again. It reconnects and picks up the new id.

If the banner doesn't appear after an admin cleared the id, close and reopen the App Builder tab: it reads the id when it opens.

## Troubleshooting

| Symptom                                                        | Cause                                                                                       | Fix                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Stage 1: `Your organization has no developer id yet`           | The org hasn't claimed a developer id.                                                      | Claim one (see above), then run Stage 1 again.                                                                              |
| Stage 1 still says no developer id after claiming              | The notebook's connection has the old identity.                                             | Run the Stage 1 skip-ahead cell, which reconnects. Or restart the kernel and **Run All**.                                   |
| Stage 3: deploy refused, namespace or permission error         | The app id's prefix isn't this org's developer id, or the attendee can't deploy apps.       | Run the Stage 1 skip-ahead cell to recreate the app under the right id. Check the attendee's org role.                      |
| Stage 3: `The cloud build of vN failed`                        | The clock code doesn't compile, usually after an edit to `APP_TSX`.                         | Read the build log the cell prints. Run the Stage 2 skip-ahead cell to restore the finished clock, then run Stage 3 again. |
| Stage 3: `vN is still building`                                | The cloud build took longer than 5 minutes.                                                 | Wait a minute, then run the Stage 3 skip-ahead cell. It publishes the newest finished version.                              |
| The link opens but the clock isn't on the desktop              | The desktop shows new apps after it refreshes.                                              | Reload the page, or sign out and back in.                                                                                   |
| The alarm flashes but doesn't beep                             | The browser blocks sound until you click on the page.                                       | Click **Set alarm** (that click turns sound on), and check the tab isn't muted.                                             |
| `No module named 'rocketride'` after Setup                     | The SDK was updated while it was already imported.                                          | Restart the kernel, then **Run All**.                                                                                       |
| Setup: `Couldn't install the RocketRide SDK`                   | pip failed: no internet, a proxy, or no pip in that Python.                                 | Read the pip error the cell prints. Switch networks, or pick another Python in **Select Kernel**.                           |
| VS Code asks to install `ipykernel`, or the kernel won't start | The selected interpreter has no `ipykernel`.                                                | Accept the prompt, or run `python3 -m pip install ipykernel` for that interpreter.                                          |
| The Config cell keeps asking for the key                       | No `ROCKETRIDE_APIKEY` in the environment or in a `.env` next to the notebook.              | Paste the key when asked; it's kept for the session. To skip the prompt, create the `.env` described in SETUP.md.           |

## Skip-ahead guide

Every stage ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`. Running it puts the attendee where the stage should have ended, so they can carry on with the next stage.

- **Stuck in Stage 1:** the skip-ahead cell reconnects, deletes `build/apps/alarm_clock` and creates the app again from the template.
- **Stuck in Stage 2:** the skip-ahead cell writes the finished clock and README.
- **Stuck in Stage 3:** the skip-ahead cell publishes the newest version that finished building, and prints the link.

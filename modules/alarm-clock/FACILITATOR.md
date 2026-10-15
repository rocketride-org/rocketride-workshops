# Facilitator notes: Alarm clock

Operational notes for running this module. Time box: **15 minutes**. Attendees do every step by hand from the guide: three terminal commands, a Claude Code prompt, then deploy and publish in the App Builder. The notebook is only the fallback clock.

## Run of show

| Step                         | Time  | Where people fall behind                                                                       |
| ---------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| Start the project            | 4 min | `rocketride` not on PATH. A `.env` saved as UTF-16 or in the wrong folder. A wrong `--developer`.|
| Ask Claude for the clock     | 3 min | No Claude Code, or not signed in: send them to the fallback notebook.                           |
| See it in the App Builder    | 2 min | pnpm missing, so the preview can't build. First build is slow on venue wifi.                    |
| Deploy from the App Builder  | 6 min | The cloud build takes a minute or two. Have them watch the version card's build ticker.         |

## Before the event

- [ ] Decide which org attendees deploy into, and whether it has a developer id. To claim one live, it must be empty. Put the id on a slide: everyone needs it for `rocketride app create`.
- [ ] To clear a developer id: a sys.admin opens admin-ui → Orgs → the org → Edit, clears **Developer Id** and saves. Users can't rename or remove a claimed id themselves.
- [ ] Do the whole guide yourself on the venue wifi, in an empty folder, and time the first `app create` install and the cloud build.
- [ ] Open the published clock on cloud.rocketride.ai and check it ticks and the alarm rings.
- [ ] Tell attendees to do "Set up at home", including Node, pnpm and Claude Code, and to practice Start the project once.

## Claiming a developer id live

1. An org admin opens the RocketRide App Builder in VS Code and goes to the **Deploy** tab.
2. The registration banner asks for a developer id: letters and underscores only, for example `acme_labs`. `local` and `rocketride` are taken.
3. Click **Register**. Each org can claim only one id, and it can't be changed afterwards without a sys.admin.
4. Attendees pass it to `rocketride app create ... --developer <id>`.

If the banner doesn't appear after an admin cleared the id, close and reopen the App Builder tab: it reads the id when it opens.

## Troubleshooting

| Symptom                                                      | Cause                                                                      | Fix                                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `rocketride: command not found`                              | pip's scripts folder isn't on `PATH`.                                      | Use `python -m rocketride.cli.main` with the same arguments, or install into a virtual environment and activate it.      |
| pip: `externally-managed-environment`                        | A system Python that blocks pip.                                           | `python3 -m venv .venv`, activate it, run `python3 -m pip install rocketride` again.                                              |
| Init: `Error: No authorization provided`                     | No usable key in `.env`. rocketride 1.4.0 can't sign in through the browser (its server probe logs in with an empty key), so the key in `.env` is required. | Check `.env` is in the project folder, has `ROCKETRIDE_URI=https://api.rocketride.ai` and `ROCKETRIDE_APIKEY=<key>`, and is saved. |
| Init: `UnicodeDecodeError` ... `byte 0xff`                   | `.env` was made with `echo ... > .env` in PowerShell, which writes UTF-16. | In VS Code: status bar **UTF-16 LE** → **Save with Encoding** → **UTF-8**. Or recreate it with **New File**.             |
| Init: `Stored credentials ... were rejected`                 | The key is wrong or revoked.                                               | New key at cloud.rocketride.ai, paste into `.env`, rerun `rocketride init`.                                              |
| `app create` fails on `pnpm`                                 | pnpm isn't installed, or the editor started before it was.                 | `npm install -g pnpm@latest`, restart the editor, run `pnpm install` in the project folder.                              |
| App id starts with `local.`                                  | `--developer` was left out.                                                | Delete `apps/alarm_clock` and rerun `app create` with `--developer <id>`.                                                |
| `claude: command not found`                                  | Claude Code isn't installed, or the terminal predates the install.         | Use the fallback notebook: save it in the project folder and run its cell.                                               |
| Preview blank or shows an error                              | The clock Claude wrote doesn't compile.                                    | Copy the **Errors** pane into Claude and ask for a fix, or run the fallback cell.                                        |
| Deploy tab read-only, namespace banner                       | The app id's prefix isn't this org's developer id.                         | Delete `apps/alarm_clock`, rerun `app create` with the right `--developer`, then the fallback cell or Claude again.      |
| Version card shows **failed**                                | The cloud build failed.                                                    | Click the badge for the build log. Fix with Claude or the fallback cell, check the preview, then **Deploy** again.       |
| The clock isn't on the desktop after publishing               | The desktop shows new apps after it refreshes.                             | Reload cloud.rocketride.ai.                                                                                              |
| The alarm flashes but doesn't beep                           | The browser blocks sound until you click on the page.                      | Click **Set alarm** (that click turns sound on), and check the tab isn't muted.                                          |

## The fallback

`alarm-clock.ipynb` has one code cell. It writes a finished clock into `apps/alarm_clock/src/App.tsx` and a README, and stops with a clear message if `apps/alarm_clock` doesn't exist yet. It needs a Python 3.10+ kernel and nothing else: no client, no network. The App Builder's preview picks up the files as soon as they're saved.

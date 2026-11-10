# Facilitator notes: Kanban board

Operational notes for running this module. Time box: **5 minutes** in the room. Attendees do every step by hand from the guide: two terminal commands, a Claude Code prompt or one pasted file, then one deploy command.

## Run of show

| Step              | Time  | Where people fall behind                                                                                      |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| Start the project | 1 min | Opening a different folder than the `kanban` one from home, so `init` asks them to sign in again. Slow first package install on venue wifi. |
| Build the board   | 2 min | No Claude Code, or not signed in: send them to the **Files** tab.                                              |
| Deploy it         | 2 min | The cloud build takes about a minute. The command waits and prints `build v1:` lines; tell them to let it run. |

## Before the event

- [ ] Decide which org attendees deploy into, and whether it has a developer id. Put it on a slide. To claim one live, it must be empty.
- [ ] To clear a developer id: a sys.admin opens admin-ui → Orgs → the org → Edit, clears **Developer Id** and saves. Users can't rename or remove a claimed id themselves.
- [ ] Do the whole guide yourself on the venue wifi, from an empty folder, and time `init`, `app create` and the cloud build.
- [ ] Open the published board on cloud.rocketride.ai: add a card, drag it, reload, and check it stayed.
- [ ] Tell attendees to do "Set up at home", including the sign-in in the `kanban` folder.

## Claiming a developer id live

An org admin, in a signed-in folder:

```sh
rocketride app developer status
rocketride app developer register acme_labs   # lowercase letters and underscores; permanent
```

`local` and `rocketride` are taken. Each org can claim only one id. Attendees don't pass it anywhere: `app create` reads it from their sign-in.

## Troubleshooting

| Symptom                                                 | Cause                                                                    | Fix                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `rocketride` or `pnpm`: command not found               | Not installed, or the terminal predates the install.                     | `npm install -g pnpm@latest rocketride@latest`, then open a new terminal.                               |
| npm `EACCES` (Mac/Linux)                                | Global installs need permission.                                         | Same command with `sudo`.                                                                               |
| `running scripts is disabled` (Windows)                 | PowerShell's execution policy blocks npm's shims.                        | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, new PowerShell.                                   |
| `init` opens the browser in the room                    | No `.env` in this folder: a different folder, or no sign-in at home.     | Sign in; it carries on. Check the prompt ends in `kanban`.                                              |
| `app create` warns it's using `'local'`                 | The org has no developer id, or the sign-in didn't load.                 | Claim the id, delete `apps/kanban-ui`, rerun `app create` (with `--developer <id>` if needed).          |
| `claude: command not found`                             | Claude Code isn't installed.                                             | Use the **Files** tab.                                                                                  |
| The deploy fails at the build                           | The board doesn't compile.                                               | `rocketride app log kanban`, then fix with Claude or paste the Files tab's `App.tsx`, deploy again.      |
| The deploy fails on the app id or namespace             | The id starts with `local` or another org's id.                          | As for the `'local'` warning above.                                                                     |
| The board isn't on the desktop                          | The desktop shows new apps when it loads.                                | Reload cloud.rocketride.ai.                                                                             |

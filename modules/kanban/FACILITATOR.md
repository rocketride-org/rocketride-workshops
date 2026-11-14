# Facilitator notes: Kanban board

Operational notes for running this module. Time box: **10 minutes** in the room. The hour ends with 3 minutes of feedback after Specter Mutual (0:57): see its FACILITATOR notes. Attendees do every step by hand from the guide: two terminal commands, a Claude Code prompt or one pasted file, then one deploy command.

## Say these out loud

Don't skip these on stage. Each one stalled the LA run when it was skipped.

- [ ] **Step 3, before anything else:** "Sign up, then redeem `WORKSHOP_LA_001` in the **Have a promo code?** bar at the bottom of your desktop." Show the bar on the projector. Without it, the deploy fails on a plan error.
- [ ] **Step 3:** "Run `rocketride app developer status`. No id? Register one now." Without it, `app create` uses `local` and the deploy fails.
- [ ] **End of Step 6:** point at the **Give feedback** box under "Done when". Anyone leaving early should fill it in now.
- [ ] **Questions:** take them at the Step 3 and Step 6 checkpoints, not mid-step.

## Run of show

| Step              | Time  | Where people fall behind                                                                                      |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| Get your account ready | 3 min | Most people skip home setup. Sign-up email slow or in spam. Not finding the **Have a promo code?** bar at the bottom of the desktop. `rocketride login` run outside the `kanban` folder. Skipping `developer register`. |
| Start the project | 2 min | Opening a different folder than the `kanban` one from home, so `init` asks them to sign in again. Slow first package install on venue wifi. |
| Build the board   | 4 min | No Claude Code, not signed in, or no Claude plan: send them to the **Files** tab.                               |
| Deploy it         | 4 min | The cloud build takes about a minute. The command waits and prints `build v1:` lines; tell them to let it run. |

## Before the event

- [ ] Each attendee's new account is its own organization and they are its admin. There is no shared workshop org: every attendee claims their own developer id in Step 3 (Get your account ready), in the room or at home.
- [ ] Attendees redeem the workshop code `WORKSHOP_LA_001` in the **Have a promo code?** bar on their cloud.rocketride.ai desktop. It activates their plan; they never buy a subscription.
- [ ] To clear a developer id: a sys.admin opens admin-ui → Orgs → the org → Edit, clears **Developer Id** and saves. Users can't rename or remove a claimed id themselves.
- [ ] Do the whole guide yourself on the venue wifi, from an empty folder, and time `init`, `app create` and the cloud build.
- [ ] Open the published board on cloud.rocketride.ai: add a card, edit it, drag it to another column and reorder it, delete one, reload, and check it all stayed.
- [ ] Tell attendees to do "Set up at home" (tools and the `kanban` folder), and Step 3 too if they want a head start.

## Claiming a developer id live

In a signed-in folder:

```sh
rocketride app developer status
rocketride app developer register yourname_dev   # letters and underscores; can't be renamed later
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
| The deploy mentions a plan, subscription or credits     | The workshop code wasn't redeemed.                                       | Redeem `WORKSHOP_LA_001` in the **Have a promo code?** bar on the desktop, deploy again.         |
| `claude: command not found`                             | Claude Code isn't installed.                                             | Use the **Files** tab.                                                                                  |
| The deploy fails at the build                           | The board doesn't compile.                                               | `rocketride app log kanban`, then fix with Claude or paste the Files tab's `App.tsx`, deploy again.      |
| The deploy fails on the app id or namespace             | The id starts with `local` or another org's id.                          | As for the `'local'` warning above.                                                                     |
| The board isn't on the desktop                          | The desktop shows new apps when it loads.                                | Reload cloud.rocketride.ai.                                                                             |

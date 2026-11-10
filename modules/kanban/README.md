# Kanban board

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/kanban/>

The first and fastest module: from an empty folder to a deployed app in 10 minutes. Attendees start a RocketRide project with the `rocketride` command, have Claude Code build a kanban to-do board (or paste the finished file), and deploy and publish it to their own desktop on cloud.rocketride.ai with one more command. The app is UI only: no pipeline, no AI behind it.

```sh
# at home, once
npm install -g pnpm@latest rocketride@latest
mkdir kanban && cd kanban
rocketride login --uri https://api.rocketride.ai   # browser sign-in; writes .env
rocketride app developer status                    # or: rocketride app developer register <id>

# in the room, in that folder
rocketride init --uri https://api.rocketride.ai
rocketride app create kanban --name "Kanban"       # writes apps/kanban-ui
claude                                             # Step 4 prompt; or paste the Files tab's App.tsx
rocketride app deploy kanban --publish @me         # waits for the cloud build, then publishes
```

**Time:** 10 minutes in the room (2 to start, 4 to build, 4 to deploy), after about 15 minutes of setup at home.

**Requires:** Node 20+, pnpm 10+, the npm `rocketride` package (1.6.0+, installed globally for the CLI), a RocketRide Cloud account with the workshop code `EXCALIDRAW_WALKTHROUGH` redeemed (it activates the plan; no subscription to buy), a developer id (each new account is its own org, so attendees claim their own, e.g. `yourname_dev`), and [Claude Code](https://claude.com/claude-code) for the Prompt tab (needs a Claude Pro/Max plan or an Anthropic Console account; otherwise the Files tab). No model key, no Python, no RocketRide extension.

## How it's built

- **All terminal, no App Builder clicks.** The npm CLI covers the whole path: `login` (browser sign-in, writes `.env` and git-ignores it), `app developer status|register`, `init`, `app create`, and `app deploy --publish @me`, which waits for the server build and publishes in one command. `app create` defaults `--developer` to the signed-in account's developer id, so attendees never type it.
- **Sign-in happens at home.** Step 2 runs `rocketride login` in the `kanban` folder attendees reuse in the room, so `init` there finds the credentials and skips the browser.
- **The board** (`apps/kanban-ui/src/App.tsx`) has three columns (To do, Doing, Done). Cards can be added, edited in place (double-click or ✎; Enter/blur saves, Esc cancels), deleted, dragged between columns or reordered within one (a line shows where they land), and moved with arrow buttons. Cards persist in the workspace `appState` through `useWorkspace()` from `shell`, which the shell saves per user; it gates on `loaded`. Styles are inline and use only `--rr-*` tokens, so it follows the user's theme.
- **The fallback is a Files tab**, not a notebook: the finished `App.tsx` to paste over the template's. It was type-checked under `strict` against the `shell` typings of a scaffolded app.

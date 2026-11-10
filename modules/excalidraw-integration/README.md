# Give Excalidraw a diagram agent

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/excalidraw-integration/>

Attendees clone [Excalidraw](https://github.com/excalidraw/excalidraw), add the RocketRide TypeScript SDK, and add a **Diagram agent** tab (a brain button) to Excalidraw's right-hand sidebar. They write five files, by pasting a prompt into a coding agent or pasting the files themselves, then deploy the agent's pipeline to RocketRide Cloud. Asked about a public GitHub repo, the agent reads it with a GET-only tool locked to `raw.githubusercontent.com`, then answers with Mermaid that the panel draws on the canvas. Follow-up messages replace the diagram. The whole module is the guide. There is no notebook: attendees run every command themselves.

**Time:** 15 minutes in the room (Steps 5–7). Steps 2–4 (setup, the ~900 MB clone and install, sign-in and `.env`) are done at home.

**Requires:** Node 20+, Yarn 1 (`npm install -g yarn`), git, a RocketRide Cloud account with the workshop code redeemed, and an Anthropic API key (with a few dollars of credit) saved in RocketRide Cloud under **Settings → Environment Variables** as the user variable `ROCKETRIDE_ANTHROPIC_KEY`. No Python: the `rocketride` command comes from the npm `rocketride` package the module installs, run with `npx`.

## The flow

```sh
# At home
git clone https://github.com/excalidraw/excalidraw.git   # slow link: add --filter=blob:none
cd excalidraw
git checkout 701b901        # git prints a detached HEAD note; expected
yarn workspace excalidraw-app add rocketride@1.6.0   # also installs all of Excalidraw (~900 MB)
npx rocketride login --uri https://api.rocketride.ai  # browser sign-in; writes ROCKETRIDE_* and ROCKETRIDE_DEPLOY_* to .env
# append to .env: VITE_APP_ROCKETRIDE_URI=$ROCKETRIDE_URI and VITE_APP_ROCKETRIDE_APIKEY=$ROCKETRIDE_APIKEY

# In the room
# Step 5: paste the prompt into a coding agent, or paste the five files
npx rocketride deploy add pipelines/diagram-agent.pipe --deploy-to Development     # Step 6: new version, pointed at the Development team
npx rocketride deploy run dafb1567-0f6e-4b87-a00e-74ce8bef1db7 webhook_1 --team Development   # Step 6: start it
yarn start                  # Step 7, localhost:3001: Library button > brain tab > ask; the diagram is drawn on the canvas
```

| File | Step |
| --- | --- |
| `pipelines/diagram-agent.pipe` | New: the agent pipeline (webhook → question → agent with Claude, memory and a GitHub tool → answers), deployed in Step 6 |
| `excalidraw-app/components/diagramAgent.ts` | New: the RocketRide client and `askDiagramAgent()`. It holds no pipeline: it finds the deployed run (`getTaskToken` with the pipe's `project_id`, `webhook_1` and the account's `devTeam`) and sends the chat to it |
| `excalidraw-app/components/DiagramAgentPanel.scss` | New: orders the sidebar's tab buttons search, brain, library (Radix trigger ids end in `-trigger-<tab>`) |
| `excalidraw-app/components/DiagramAgentPanel.tsx` | New: the sidebar chat, built on Excalidraw's own `ChatInterface`. Draws each valid answer on the canvas, replacing the agent's previous diagram in one undo step; retry on failed requests (`errorType: "network"`), Regenerate (auto-fix) on unparseable Mermaid, insert adds a copy |
| `excalidraw-app/components/AppSidebar.tsx` | Replace: Excalidraw's file at `701b901`, plus a `brainIconThin` `Sidebar.TabTrigger` (no style, no opacity, so it matches search and library; `brainIcon` has a heavier stroke and reads darker) and a `Sidebar.Tab` holding `DiagramAgentPanel` |

Step 5 has two tabs: **Prompt** (first, open by default; 5–8 minutes) asks a coding agent to do the integration from a description, and **Files** holds the reference versions of the five files to paste. Both produce the same sidebar tab; Excalidraw's `AI.tsx` and Text to diagram dialog are left alone. The file boxes are HTML-escaped copies of the reference files. If you change one, regenerate its box rather than editing the HTML by hand, and update the prompt to match. A coding agent's version differs a little from the reference; the guide tells attendees to paste the Files tab boxes over it if Step 7 fails.

## Why it's built this way

- **Excalidraw is pinned to commit `701b901`.** The guide replaces the whole `AppSidebar.tsx`, so it has to match the attendee's copy, and the panel imports Excalidraw internals (`TTDDialog/Chat`, `useApp`, `brainIconThin`). To move the pin, take the new `AppSidebar.tsx`, reapply the change (import `brainIconThin` and `DiagramAgentPanel`, add the trigger and the tab), check the internals still exist, and regenerate the boxes.
- **Keys go in `.env` at the repo root, written by `rocketride login`.** `login` (npm `rocketride@1.6.0`) writes `<cwd>/.env`, updating only its own keys and keeping other lines, mirrors the dev pair into `ROCKETRIDE_DEPLOY_*` by default, and adds `.env` to `.gitignore` (Excalidraw's own `.gitignore` covers `.env.local` but not `.env`). Vite reads env files from the repo root (`envDir: "../"` in `excalidraw-app/vite.config.mts`) and only exposes `VITE_*`, so two `VITE_APP_` lines reference the login keys with `$NAME`: Vite's dotenv-expand fills them in, and the deploy key never reaches the browser. Step 6 deploys with the 1.6.0 CLI, which reads the deploy pair from `.env` itself; `--deploy-to`/`--team` take a team name (case-insensitive) as well as an id, and `Development` is the name of the account's `devTeam`, the team the app looks in. Vite expands the `$` lines; the CLI and Node ignore them.
- **The pipeline's `project_id` is hard-coded.** That's fine: every attendee's account is its own organization, so each deploys the same project id into their own org without colliding.
- **No `rocketride init`.** In a Yarn monorepo, `init` creates `pnpm-workspace.yaml` and runs `pnpm install` across the repo unless given `--no-install`. The browser SDK doesn't need anything `init` sets up, so the module skips it and Python with it.
- **`askDiagramAgent()` never throws.** It returns `{ generatedResponse, error: null }` on success or `{ error: RequestError }` on failure, and the panel shows the error in the chat with a retry button. Every failure (no connection, the agent not running, a wrong key, an empty answer) comes back that way, so the page never crashes. The agent's last `answers` entry is the Mermaid; a stray code fence around it is stripped.

## What was verified

An earlier version of this module (which rewired the Text to diagram dialog through `AI.tsx`) was checked at commit `701b901` from a fresh clone: clone plus checkout took ~7s, the install ~46s on a fast link, and `yarn start` served in under 10s; `tsc`, ESLint and Prettier were clean. The current sidebar-tab version and a live run against RocketRide Cloud are the first facilitator dry-run items.

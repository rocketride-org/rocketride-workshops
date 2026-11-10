# Give Excalidraw a diagram agent

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/excalidraw-integration/>

Attendees clone [Excalidraw](https://github.com/excalidraw/excalidraw), add the RocketRide TypeScript SDK, and add two files, by pasting a prompt into a coding agent or pasting the files themselves. After that, Excalidraw's built-in **Text to diagram** dialog is answered by a RocketRide agent instead of Excalidraw's own AI backend. Asked about a public GitHub repo, the agent reads it with a GET-only tool locked to `raw.githubusercontent.com`, then answers with Mermaid that Excalidraw draws. Follow-up messages revise the diagram. The whole module is the guide. There is no notebook: attendees run every command themselves, and write the two files with the guide's prompt or paste them.

**Time:** 15 minutes

**Requires:** Node 20+, Yarn 1 (`npm install -g yarn`), git, a RocketRide Cloud account with a subscription, and an Anthropic API key saved as the RocketRide Cloud Variable `ROCKETRIDE_ANTHROPIC_KEY`. No Python: the `rocketride` command comes from the npm `rocketride` package the module installs, run with `npx`.

## The flow

```sh
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
git checkout 701b901        # git prints a detached HEAD note; expected
yarn workspace excalidraw-app add rocketride@1.6.0   # also installs all of Excalidraw (~900 MB)
npx rocketride login --uri https://api.rocketride.ai  # browser sign-in; writes ROCKETRIDE_* and ROCKETRIDE_DEPLOY_* to .env
# append to .env: VITE_APP_ROCKETRIDE_URI=$ROCKETRIDE_URI and VITE_APP_ROCKETRIDE_APIKEY=$ROCKETRIDE_APIKEY
# Step 5: paste the prompt into a coding agent, or paste the files
npx rocketride deploy add pipelines/diagram-agent.pipe --deploy-to Development     # Step 6: new version, pointed at the Development team
npx rocketride deploy run dafb1567-0f6e-4b87-a00e-74ce8bef1db7 webhook_1 --team Development   # Step 6: start it
yarn start                  # localhost:3001: Library button > brain tab > ask; the diagram is drawn on the canvas
```

| File | Step |
| --- | --- |
| `excalidraw-app/components/diagramAgent.ts` | New: the RocketRide client, the agent pipeline (webhook → question → agent with Claude, memory and a GitHub tool → answers) and `askDiagramAgent()` |
| `pipelines/diagram-agent.pipe` | New: the agent pipeline, deployed in Step 6 |
| `excalidraw-app/components/DiagramAgentPanel.tsx` | New: the sidebar chat, built on Excalidraw's own `ChatInterface`. Draws each valid answer on the canvas, replacing the agent's previous diagram in one undo step; retry on failed requests (`errorType: "network"`), Regenerate (auto-fix) on unparseable Mermaid, insert adds a copy |
| `excalidraw-app/components/DiagramAgentPanel.scss` | New: orders the sidebar's tab buttons search, brain, library (Radix trigger ids end in `-trigger-<tab>`) |
| `excalidraw-app/components/AppSidebar.tsx` | Replace: Excalidraw's file at `701b901`, plus a `brainIconThin` `Sidebar.TabTrigger` (no style, no opacity, so it matches search and library; `brainIcon` has a heavier stroke and reads darker) and a `Sidebar.Tab` holding `DiagramAgentPanel` |

Step 5 has two tabs: **Prompt** (first, open by default) asks a coding agent to do the integration from a description, and **Files** holds the reference `diagram-agent.pipe`, `diagramAgent.ts`, `DiagramAgentPanel.scss`, `DiagramAgentPanel.tsx` and `AppSidebar.tsx` to paste. Both tabs produce the same sidebar tab; `AI.tsx` and the Text to diagram dialog are left alone. The two file boxes are generated from these files, HTML-escaped. If you change either file, regenerate its box rather than editing the HTML by hand, and update the prompt to match. A coding agent's version differs a little from the reference; the guide tells attendees to paste the file tabs over it if Step 6 fails.

## Why it's built this way

- **Excalidraw is pinned to commit `701b901`.** The guide pastes a whole `AI.tsx`, so it has to match the attendee's copy. Upstream changed that file 3 times from August to October 2026, and the latest tag (v0.18.1) predates the streaming Text to diagram dialog. To move the pin, take the new `AI.tsx`, reapply the change (drop the `TTDStreamFetch` import, import `askDiagramAgent`, replace the `TTDStreamFetch` call), and regenerate the box.
- **Keys go in `.env` at the repo root, written by `rocketride login`.** `login` (npm `rocketride@1.6.0`) writes `<cwd>/.env`, updating only its own keys and keeping other lines, mirrors the dev pair into `ROCKETRIDE_DEPLOY_*` by default, and adds `.env` to `.gitignore` (Excalidraw's own `.gitignore` covers `.env.local` but not `.env`). Vite reads env files from the repo root (`envDir: "../"` in `excalidraw-app/vite.config.mts`) and only exposes `VITE_*`, so two `VITE_APP_` lines reference the login keys with `$NAME`: Vite's dotenv-expand fills them in, and the deploy key never reaches the browser. Step 6 deploys with the 1.6.0 CLI: `npx rocketride deploy add pipelines/diagram-agent.pipe --deploy-to Development`, then `npx rocketride deploy run <project_id> webhook_1 --team Development`. The CLI reads the deploy pair from `.env` itself, and `--deploy-to`/`--team` take a team name (case-insensitive) as well as an id; `Development` is the name of the account's `devTeam`, the team the app looks in. This replaced a `node -e` one-liner whose quoting broke in PowerShell, then a `deploy-agent.cjs` script. Vite expands the `$` lines; the CLI and Node ignore them.
- **No `rocketride init`.** In a Yarn monorepo, `init` creates `pnpm-workspace.yaml` and runs `pnpm install` across the repo unless given `--no-install`. The browser SDK doesn't need anything `init` sets up, so the module skips it and Python with it.
- **The guide HTML writes one parenthesis as `fetch&#40;`.** `scripts/validate.mjs` rejects any HTML containing `fetch(`, and the pasted `AI.tsx` has one in Excalidraw's own diagram-to-code code. The entity renders and copies as `(`, because the Copy button in `assets/codelab.js` copies `pre.innerText`. The code itself is unchanged.
- **`askDiagramAgent()` returns what the dialog expects and never throws.** Excalidraw's `onTextSubmit` wants `{ generatedResponse, error: null }` on success or `{ error: RequestError }` on failure, and shows the error in the chat. Every failure (no connection, a wrong key, an empty answer) comes back that way, so the page never crashes. The agent's last `answers` entry is the Mermaid; a stray code fence around it is stripped.

## What was verified

At commit `701b901`, from a fresh clone following the guide's commands: clone plus checkout took ~7s, the install ~46s, and `yarn start` served in under 10s; `tsc`, ESLint and Prettier were clean. In Chrome, Text to diagram called the agent through the SDK (it dialed `wss://api.rocketride.ai/task/service`), a connection failure showed as a readable chat error, and a fenced Mermaid answer rendered and inserted on the canvas. A live run against RocketRide Cloud wasn't possible from the build environment; it's the first facilitator dry-run item.

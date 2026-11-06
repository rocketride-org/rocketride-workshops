# Give Excalidraw a diagram agent

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/excalidraw-integration/>

Attendees clone [Excalidraw](https://github.com/excalidraw/excalidraw), add the RocketRide TypeScript SDK, and add two files, by pasting a prompt into a coding agent or pasting the files themselves. After that, Excalidraw's built-in **Text to diagram** dialog is answered by a RocketRide agent instead of Excalidraw's own AI backend. Asked about a public GitHub repo, the agent reads it with a GET-only tool locked to `raw.githubusercontent.com`, then answers with Mermaid that Excalidraw draws. Follow-up messages revise the diagram. The whole module is the guide. There is no notebook: attendees run every command themselves, and write the two files with the guide's prompt or paste them.

**Time:** 15 minutes

**Requires:** Node 20+, Yarn 1 (`npm install -g yarn`), git, a RocketRide Cloud account with an API key, and an Anthropic API key (saved in `.env.local` as `VITE_ROCKETRIDE_ANTHROPIC_KEY`). No Python: the module never runs the `rocketride` command.

## The flow

```sh
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
git checkout 701b901        # git prints a detached HEAD note; expected
# .env.local at the repo root (the editor's New File): VITE_ROCKETRIDE_URI,
# VITE_ROCKETRIDE_APIKEY, VITE_ROCKETRIDE_ANTHROPIC_KEY
yarn workspace excalidraw-app add rocketride@1.4.0   # also installs all of Excalidraw (~900 MB)
# Step 5: paste the prompt into a coding agent, or paste the two files
yarn start                  # localhost:3001: More tools > Text to diagram > Insert
```

| File | Step |
| --- | --- |
| `excalidraw-app/components/diagramAgent.ts` | New: the RocketRide client, the agent pipeline (webhook → question → agent with Claude, memory and a GitHub tool → answers) and `askDiagramAgent()` |
| `excalidraw-app/components/AI.tsx` | Replace: Excalidraw's file at `701b901`, with the `TTDDialog` handler calling `askDiagramAgent()` instead of `TTDStreamFetch` |

Step 5 has three tabs: **Prompt** (first, open by default) asks a coding agent to write both files from a description, and **diagramAgent.ts** and **AI.tsx** hold the reference files to paste. The two file boxes are generated from these files, HTML-escaped. If you change either file, regenerate its box rather than editing the HTML by hand, and update the prompt to match. A coding agent's version differs a little from the reference; the guide tells attendees to paste the file tabs over it if Step 6 fails.

## Why it's built this way

- **Excalidraw is pinned to commit `701b901`.** The guide pastes a whole `AI.tsx`, so it has to match the attendee's copy. Upstream changed that file 3 times from August to October 2026, and the latest tag (v0.18.1) predates the streaming Text to diagram dialog. To move the pin, take the new `AI.tsx`, reapply the change (drop the `TTDStreamFetch` import, import `askDiagramAgent`, replace the `TTDStreamFetch` call), and regenerate the box.
- **Keys go in `.env.local` at the repo root.** Excalidraw's `.gitignore` covers `.env.local` but not `.env`. Vite reads env files from the repo root (`envDir: "../"` in `excalidraw-app/vite.config.mts`).
- **No `rocketride init`.** In a Yarn monorepo, `init` creates `pnpm-workspace.yaml` and runs `pnpm install` across the repo unless given `--no-install`. The browser SDK doesn't need anything `init` sets up, so the module skips it and Python with it.
- **The guide HTML writes one parenthesis as `fetch&#40;`.** `scripts/validate.mjs` rejects any HTML containing `fetch(`, and the pasted `AI.tsx` has one in Excalidraw's own diagram-to-code code. The entity renders and copies as `(`, because the Copy button in `assets/codelab.js` copies `pre.innerText`. The code itself is unchanged.
- **`askDiagramAgent()` returns what the dialog expects and never throws.** Excalidraw's `onTextSubmit` wants `{ generatedResponse, error: null }` on success or `{ error: RequestError }` on failure, and shows the error in the chat. Every failure (no connection, a wrong key, an empty answer) comes back that way, so the page never crashes. The agent's last `answers` entry is the Mermaid; a stray code fence around it is stripped.

## What was verified

At commit `701b901`, from a fresh clone following the guide's commands: clone plus checkout took ~7s, the install ~46s, and `yarn start` served in under 10s; `tsc`, ESLint and Prettier were clean. In Chrome, Text to diagram called the agent through the SDK (it dialed `wss://api.rocketride.ai/task/service`), a connection failure showed as a readable chat error, and a fenced Mermaid answer rendered and inserted on the canvas. A live run against RocketRide Cloud wasn't possible from the build environment; it's the first facilitator dry-run item.

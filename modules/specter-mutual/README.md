# Specter Mutual: zero to a deployed app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/>

The last Zero to Agent module: a fresh RocketRide app, built from nothing on the attendee's laptop and deployed to their workspace. Attendees build an AI claims reviewer for Specter Mutual, a fictional insurer that covers paranormal damage. A RocketRide agent reviews each claim and recommends approve, deny or escalate; a policy engine, plain code with no AI in it, holds that recommendation to the rules; and a claims portal puts it in front of people.

**Time:** 32 minutes in the room, then 3 minutes of feedback, the last of three projects in a one-hour workshop (Kanban, Excalidraw, Specter Mutual). The guide is the walkthrough. Attendees work in VS Code (or Cursor or Windsurf), paste files from it, test the agent through a chat source in the pipeline editor, and build the portal's screens with one Claude Code prompt:

| Step | What attendees do | Time |
| --- | --- | --- |
| Start the project | All in VS Code: make and open a `specter-mutual` folder, sign in with the RocketRide extension, create the app with the App Builder's New App wizard (`specter-mutual`, "Specter Mutual", Blank), then two find/replace edits in `appManifest` (the `description` line, and `"authenticated": false,` → `"authenticated": true,` + `"include": ["pipelines"],`) | 6 min |
| Build the brain | **New Pipeline** in the RocketRide panel with a **Webhook** source (this creates `pipelines/`), paste `claims.pipe` over it. In the pipeline editor, add a **Chat** source (Add node → Chat) wired to the agent's `questions` input, run it (▶ on the Chat box, then **Chat now**), and paste three test claims (SM-1001 approve, SM-1003 deny, SM-1004 escalate) into the chat; SM-1002, SM-1005 and SM-1006 are optional. Then stop and delete the Chat source and save | 10 min |
| Build the portal | Paste `src/policy.ts`, `src/claims.ts`, `src/apiKey.ts` (3 min), `src/theme.ts`, `src/useSpecterTheme.ts` (2 min). One prompt builds nine components and `App.tsx` and type-checks them (about 5 min, sometimes longer). Then App Builder Design → Preview | 14 min |
| Deploy | App Builder Deploy tab → Deploy → Publish to… → @me, then **Finish** opens the feedback dialog (500 free tokens). Optional: try to beat the agent with fraud claims (SM-1007's disguised possession and others) in the live portal | 5 min |

## Fallback notebooks

The notebooks are a fallback only, for anyone who can't get a step running locally (no Claude Code, or a step that won't come right). The guide links them only from the **Use the fallback** questions in each step's FAQ.

| Notebook | Fallback for | What it does |
| --- | --- | --- |
| [`specter-mutual.ipynb`](specter-mutual.ipynb) | | Overview and the shared helpers, loaded by every part with `%run` |
| [`01-project-init.ipynb`](01-project-init.ipynb) | Start the project (manifest edit) | Connects, checks the app exists, writes `authenticated` and `include` |
| [`02-pipeline-build.ipynb`](02-pipeline-build.ipynb) | Build the brain | Writes `pipelines/claims.pipe` and sends it the test claims. It also writes a model-only `pipelines/claims-4a.pipe` and a Python `policy.py` (its own three-beat walk-through); the portal doesn't use them |
| [`03-ui-build.ipynb`](03-ui-build.ipynb) | Build the portal | Writes the finished reference portal into `apps/specter-mutual/` |

They're saved into the attendee's project folder, next to the `.env` the RocketRide extension writes when you sign in, and need `rocketride` and `nbformat` (`python3 -m pip install rocketride nbformat`) so `%run` can load the shared notebook. They hold only the build: no installs, no scaffolding, no deploy. The files the guide pastes are the notebooks' `%%writefile` and `# Write` cells, so both paths produce the same pipelines and logic.

**Requires:** Node 20+ and pnpm 10+, Claude Code (signed in; needs a Claude Pro/Max plan or an Anthropic Console account), VS Code (or Cursor or Windsurf) with the RocketRide extension, a RocketRide Cloud account with the workshop code redeemed, a developer id (usually claimed in the Kanban project), and `ROCKETRIDE_ANTHROPIC_KEY` saved as a user variable in RocketRide Cloud (Settings → Environment Variables; set once for Excalidraw and Specter Mutual). Every attendee's account is its own organization, and they are its admin. Python 3.10+ and the Python and Jupyter extensions are needed only for the fallback notebooks.

## Keeping the guide in sync

The code boxes in `index.html` are copies of the notebooks' file cells, HTML-escaped. When a pipeline or a logic file changes in a notebook, regenerate the matching box in the guide (escape `&`, `<`, `>` and quotes) so the two paths stay identical.

# Specter Mutual: zero to a deployed app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/>

The last Zero to Agent module: a fresh RocketRide app, built from nothing on the attendee's laptop and deployed to their workspace. Attendees build an AI claims reviewer for Specter Mutual, a fictional insurer that covers paranormal damage. A RocketRide agent reviews each claim and recommends approve, deny or escalate; a policy engine, plain code with no AI in it, holds that recommendation to the rules; and a claims portal puts it in front of people.

**Time:** 40 minutes. The guide is the walkthrough. Attendees work in VS Code, paste files from it, test the agent through a chat source in the pipeline editor, and build the portal's screens with one Claude Code prompt:

| Step | What attendees do | Time |
| --- | --- | --- |
| Start the project | All in VS Code: make and open a `specter-mutual` folder, sign in with the RocketRide extension, create the app with the App Builder's New App wizard (`specter-mutual`, "Specter Mutual", Blank), then two find/replace edits in `appManifest` (the `description` line, and `"authenticated": false,` → `"authenticated": true,` + `"include": ["pipelines"],`) | 6 min |
| Build the brain | **New Pipeline** in the RocketRide panel with a **Webhook** source (this creates `pipelines/`), paste `claims.pipe` over it. In the pipeline editor, add a **Chat** source wired to the agent's `questions` input, run the pipeline, and paste the six test claims and the SM-1007 fraud claim into the chat one by one. Then delete the Chat source and save | 15 min |
| Build the portal | Paste `src/policy.ts`, `src/claims.ts`, `src/apiKey.ts`, `src/theme.ts`, `src/useSpecterTheme.ts`. One prompt builds the components and `App.tsx` and type-checks them. Then App Builder Design → Preview | 13 min |
| Deploy | App Builder Deploy tab → Deploy → Publish to… → @me | 6 min |

## Fallback notebooks

The notebooks are a fallback only, for anyone who can't get a step running locally (no Claude Code, or a step that won't come right). The guide links them only from its **Stuck? Use the fallback** folds.

| Notebook | Fallback for | What it does |
| --- | --- | --- |
| [`specter-mutual.ipynb`](specter-mutual.ipynb) | | Overview and the shared helpers, loaded by every part with `%run` |
| [`01-project-init.ipynb`](01-project-init.ipynb) | Start the project (manifest edit) | Connects, checks the app exists, writes `authenticated` and `include` |
| [`02-pipeline-build.ipynb`](02-pipeline-build.ipynb) | Build the brain | Writes `pipelines/claims.pipe` (and the extra files of the earlier script-based version) and sends it the test claims |
| [`03-ui-build.ipynb`](03-ui-build.ipynb) | Build the portal | Writes the finished reference portal into `apps/specter-mutual/` |

They're saved into the attendee's project folder, next to the `.env` the RocketRide extension writes when you sign in, and need `rocketride` and `nbformat` (`python3 -m pip install rocketride nbformat`) so `%run` can load the shared notebook. They hold only the build: no installs, no scaffolding, no deploy. The files the guide pastes are the notebooks' `%%writefile` and `# Write` cells, so both paths produce the same pipelines and logic.

**Requires:** Python 3.10+, Node 20+ and pnpm 10+, Claude Code (signed in), VS Code (or Cursor or Windsurf) with the RocketRide extension, a RocketRide Cloud account, a developer id for the organization (claimed once in the App Builder's Deploy tab), and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables. The Python and Jupyter extensions are needed only for the fallback notebooks.

## Keeping the guide in sync

The code boxes in `index.html` are copies of the notebooks' file cells, HTML-escaped. When a pipeline or a logic file changes in a notebook, regenerate the matching box in the guide (escape `&`, `<`, `>` and quotes) so the two paths stay identical.

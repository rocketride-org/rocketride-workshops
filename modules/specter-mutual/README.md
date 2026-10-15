# Specter Mutual: zero to a deployed app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/>

The last Zero to Agent module: a fresh RocketRide app, built from nothing on the attendee's laptop and deployed to their workspace. Attendees build an AI claims reviewer for Specter Mutual, a fictional insurer that covers paranormal damage. A RocketRide agent reviews each claim and recommends approve, deny or escalate; a policy engine, plain code with no AI in it, holds that recommendation to the rules; and a claims portal puts it in front of people.

**Time:** 40 minutes. The guide is the walkthrough. Attendees copy commands and files from it, and run the rest as Claude Code prompts written out in it:

| Step | What attendees do | Time |
| --- | --- | --- |
| Start the project | `python3 -m pip install rocketride` (Windows: `python -m pip`), save `.env` with their API key, `rocketride init`, `rocketride app create specter-mutual --name "Specter Mutual" --developer <id>`, then edit `appManifest` (`description`, `include: ["pipelines"]`, `authenticated: true`) | 6 min |
| Build the brain | Paste `pipelines/test-claims.json`, `pipelines/claims-4a.pipe`, `pipelines/claims.pipe` and `policy.py`. Start `claude` in a second terminal. Prompts: write and run `review.py` (beat 1, model only), run it on the agent pipeline and save `agent-answers.json` (beat 2), `python3 policy.py` then `check.py` (beat 3), and the fraud claim | 15 min |
| Build the portal | Paste `src/policy.ts`, `src/claims.ts`, `src/apiKey.ts`, `src/theme.ts`, `src/useSpecterTheme.ts`. One prompt builds the components and `App.tsx` and type-checks them. Then App Builder Design → Preview | 13 min |
| Deploy | App Builder Deploy tab → Deploy → Publish to… → @me | 6 min |

## Fallback notebooks

The notebooks are a fallback only, for anyone who can't get a step running locally (no Claude Code, or a step that won't come right). The guide links them only from its **Stuck? Use the fallback** folds.

| Notebook | Fallback for | What it does |
| --- | --- | --- |
| [`specter-mutual.ipynb`](specter-mutual.ipynb) | | Overview and the shared helpers, loaded by every part with `%run` |
| [`01-project-init.ipynb`](01-project-init.ipynb) | Start the project (manifest edit) | Connects, checks the app exists, writes `authenticated` and `include` |
| [`02-pipeline-build.ipynb`](02-pipeline-build.ipynb) | Build the brain | Writes the four files the guide pastes, runs the three beats and the fraud test |
| [`03-ui-build.ipynb`](03-ui-build.ipynb) | Build the portal | Writes the finished reference portal into `apps/specter-mutual/` |

They're saved into the attendee's project folder, next to the `.env` that `rocketride init` read, and need `nbformat` (`python3 -m pip install nbformat`) so `%run` can load the shared notebook. They hold only the build: no installs, no scaffolding, no deploy. The files the guide pastes are the notebooks' `%%writefile` and `# Write` cells, so both paths produce the same pipelines and logic.

**Requires:** Python 3.10+, Node 20+ and pnpm 10+, Claude Code (signed in), VS Code (or Cursor or Windsurf) with the RocketRide extension, a RocketRide Cloud account and API key, a developer id for the organization (claimed once in the App Builder's Deploy tab), and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables. The Python and Jupyter extensions are needed only for the fallback notebooks.

## Keeping the guide in sync

The code boxes in `index.html` are copies of the notebooks' file cells, HTML-escaped. When a pipeline, `policy.py` or a logic file changes in a notebook, regenerate the matching box in the guide (escape `&`, `<`, `>` and quotes) so the two paths stay identical.

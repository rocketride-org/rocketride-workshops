# Specter Mutual: zero to a deployed app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/>

The last Zero to Agent module: a fresh RocketRide app, built from nothing on the attendee's laptop and deployed to their workspace. Attendees build an AI claims reviewer for Specter Mutual, a fictional insurer that covers paranormal damage. A RocketRide agent reviews each claim and recommends approve, deny or escalate; a policy engine, plain code with no AI in it, holds that recommendation to the rules; and a claims portal puts it in front of people.

**Time:** 40 minutes. Attendees start the project by hand from the guide, build it in three notebooks, then deploy it from the App Builder:

| Step | Where | Time |
| --- | --- | --- |
| Start the project | The guide: `pip install rocketride nbformat`, `rocketride init --uri https://api.rocketride.ai`, `rocketride app create specter-mutual --name "Specter Mutual" --developer <id>` | 3 min |
| [`specter-mutual.ipynb`](specter-mutual.ipynb) | Overview and the shared helpers (loaded by every part, not run on its own) | |
| [`01-project-init.ipynb`](01-project-init.ipynb) | Connect, check the app exists, and write its manifest (`authenticated`, `include`) | 3 min |
| [`02-pipeline-build.ipynb`](02-pipeline-build.ipynb) | A model that writes, an agent that decides, a policy engine that holds it to the rules | 15 min |
| [`03-ui-build.ipynb`](03-ui-build.ipynb) | Write the claims portal, then check it in the App Builder's Design → Preview | 12 min |
| Deploy | The guide: App Builder Deploy tab → Deploy → Publish to… → @me | 7 min |

The notebooks are saved into the attendee's project folder, the one `rocketride init` set up, and the workspace is the notebook's folder. Each part loads `specter-mutual.ipynb` with `%run`, whose client reads that folder's `.env` itself. The parts pass their work to each other through the workspace: the app in `apps/specter-mutual/`, the pipelines in `pipelines/`, and `policy.py`. The notebooks hold only the build: no installs, no scaffolding, no deploy.

**Requires:** Python 3.10+, Node 20+ and pnpm 10+ (`rocketride app create` and the App Builder's Preview run `pnpm install`), VS Code with the Python, Jupyter and RocketRide extensions, a RocketRide Cloud account, a developer id for the organization (claimed once in the App Builder's Deploy tab), and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables.

**Before you start:** install Node and pnpm (see [`SETUP.md`](../../SETUP.md)), claim or look up your developer id, then follow the guide's **Start the project** step: make a project folder, run the three commands in its terminal, and save the four notebooks into it.

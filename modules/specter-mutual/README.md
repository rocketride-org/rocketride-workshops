# Specter Mutual: zero to a deployed app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/>

The last Zero to Agent module: a fresh RocketRide app, built from nothing on the attendee's laptop and deployed to their workspace. Attendees build an AI claims reviewer for Specter Mutual, a fictional insurer that covers paranormal damage. A RocketRide agent reviews each claim and recommends approve, deny or escalate; a policy engine, plain code with no AI in it, holds that recommendation to the rules; and a claims portal puts it in front of people.

**Time:** 40 minutes, in four parts:

| Notebook | Part | Time |
| --- | --- | --- |
| [`specter-mutual.ipynb`](specter-mutual.ipynb) | Overview, Preflight, Config and the shared helpers | 3 min |
| [`01-project-init.ipynb`](01-project-init.ipynb) | Create the app from RocketRide's template | 3 min |
| [`02-pipeline-build.ipynb`](02-pipeline-build.ipynb) | A model that writes, an agent that decides, a policy engine that holds it to the rules | 15 min |
| [`03-ui-build.ipynb`](03-ui-build.ipynb) | Write the claims portal and build it locally | 14 min |
| [`04-cloud-deploy.ipynb`](04-cloud-deploy.ipynb) | Deploy and publish it to the attendee's workspace | 5 min |

Each part loads `specter-mutual.ipynb` with `%run`, and the parts pass their work to each other through `build/` (gitignored): the app in `build/apps/specter-mutual/`, the pipelines in `build/pipelines/`, and `build/policy.py`.

**Requires:** Python 3.10+, Node 20+, pnpm 10+, a RocketRide Cloud API key, a developer id for the organization (claimed once in the App Builder's Deploy tab), and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables. The notebook installs the `rocketride` Python SDK itself.

**Before you start:** install Node and pnpm (see [`SETUP.md`](../../SETUP.md)), then open [`specter-mutual.ipynb`](specter-mutual.ipynb) in VS Code, click **Run All**, and follow the guide.

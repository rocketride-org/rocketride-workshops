# Integrate RocketRide into an existing app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/notepad-integration/>

Attendees clone a small TypeScript notepad app ([`notepad-starter`](https://github.com/rocketride-org/notepad-starter)) into `./notepad-starter`, add the RocketRide TypeScript SDK, and wire one pipeline-backed feature into it: an **✨ Assist** button that summarizes the open note in 3 to 5 bullets with Claude. Everything runs from the notebook through `%%writefile` and shell cells, and the app runs locally at http://127.0.0.1:5173.

**Time:** 15 minutes

**Requires:** Python 3.10+, Node 20+, pnpm 10+, git, a RocketRide Cloud API key, and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables. The notebook installs the `rocketride` Python SDK itself.

**Before you start:** install Node, pnpm and git (see [`SETUP.md`](../../SETUP.md)), then open [`notepad-integration.ipynb`](notepad-integration.ipynb) in VS Code, click **Run All**, and follow the guide.

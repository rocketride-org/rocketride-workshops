# Integrate RocketRide into an existing app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/notepad-integration/>

Attendees wire one pipeline-backed feature into a small TypeScript notepad app ([`notepad-starter`](https://github.com/rocketride-org/notepad-starter)): an **✨ Assist** button that summarizes the open note in 3 to 5 bullets with Claude. The app runs locally at http://127.0.0.1:5173.

**Time:** 15 minutes

**Requires:** Python 3.10+, Node 20+, pnpm 10+, git, a RocketRide Cloud account, and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables.

**How it runs:** setup is done by hand, following the guide. In a terminal, in a fresh project folder, attendees run `pip install rocketride` and `rocketride init --uri https://api.rocketride.ai` (browser sign-in, writes `.env`). They then `git clone` `notepad-starter`, run `pnpm install --ignore-workspace`, and start `pnpm dev`. Later they add the SDK with `pnpm add --ignore-workspace rocketride@1.4.0` and restart `pnpm dev`. [`notepad-integration.ipynb`](notepad-integration.ipynb), saved into that project folder, holds only the build: it connects with the `.env` that init wrote, writes the source files, `.env.local` and the Summarize pipeline, and tries it.

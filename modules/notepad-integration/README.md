# Integrate RocketRide into an existing app

**Guide:** <https://rocketride-org.github.io/rocketride-workshops/modules/notepad-integration/>

Attendees add one pipeline-backed feature to a small TypeScript notepad app ([`notepad-starter`](https://github.com/rocketride-org/notepad-starter)): an **✨ Assist** button that summarizes the open note in 3 to 5 bullets with Claude. The whole module is the guide. There is no notebook: attendees run every command and paste every file themselves.

**Time:** 15 minutes

**Requires:** Python 3.10+ (for the `rocketride` command), Node 20+, pnpm 10+, git, a RocketRide Cloud account with an API key, and `ROCKETRIDE_ANTHROPIC_KEY` in the organization's RocketRide Variables.

## The flow

```sh
git clone https://github.com/rocketride-org/notepad-starter
cd notepad-starter
# .env (the editor's New File): ROCKETRIDE_URI, ROCKETRIDE_APIKEY,
# VITE_ROCKETRIDE_URI, VITE_ROCKETRIDE_APIKEY
python3 -m pip install rocketride   # Windows: python -m pip install rocketride
rocketride init
pnpm add rocketride@1.4.0   # also installs the app's other packages
# paste three files from the guide
pnpm dev                    # press ✨ Assist
```

| File | Step |
| --- | --- |
| `src/assist.ts` | New: the RocketRide client, the Summarize pipeline (webhook → question → prompt → Claude → answers) and `runAssist()` |
| `src/main.ts` | Replace: the Assist button, the answer box and the click handler |
| `src/style.css` | Add one line at the end |

The guide folds the starter's `integrated` branch (`rocketride.ts`, `assist.ts`, `assist-pipeline.json`, `vite-env.d.ts`, `tsconfig.json`) into the single `src/assist.ts`: the pipeline is inline and a `/// <reference types="vite/client" />` line types the `VITE_` settings, so no config files change. The behavior is the same. If you change the pipeline, change it in the guide too.

One `.env` in `notepad-starter` serves both the `rocketride` command (`ROCKETRIDE_*`) and Vite, which passes only `VITE_*` settings to the browser. The starter's `.gitignore` already ignores it.

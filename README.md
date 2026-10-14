<div align="center">

<a href="https://rocketride-org.github.io/rocketride-workshops/">
  <img src="images/banner.png" alt="RocketRide Workshops" width="100%">
</a>

</div>

# RocketRide Workshops

**Site:** <https://rocketride-org.github.io/rocketride-workshops/>

RocketRide's repeatable workshop kit. Workshop content is **Jupyter notebooks** you run in VS Code. You execute cells, and the build and the deploy to RocketRide Cloud happen live from the notebook.

The repo is organized as **modules**. A workshop is an ordered list of modules, so you download only the notebooks your workshop needs. Every notebook works as a single downloaded file.

## Use it

1. Open the [hub](https://rocketride-org.github.io/rocketride-workshops/), or clone this repo and open `index.html` (it works offline from disk). Pick a project card to open its step-by-step guide.
2. Do the at-home setup in [`SETUP.md`](SETUP.md), about 15 minutes.
3. Follow each project's guide: it links the notebook to download, and walks you from setup through the build to the deploy.

## Workshops

| Workshop | Modules | Time |
| --- | --- | --- |
| [Zero to Agent](https://rocketride-org.github.io/rocketride-workshops/) | [Alarm clock](https://rocketride-org.github.io/rocketride-workshops/modules/alarm-clock/) → [Integrate RocketRide into an existing app](https://rocketride-org.github.io/rocketride-workshops/modules/notepad-integration/) → [Specter Mutual](https://rocketride-org.github.io/rocketride-workshops/modules/specter-mutual/) | 60 min |

Each module's `README.md` in `modules/<id>/` links its guide and lists what it needs.

## Layout

```
index.html                  # hub: project cards for each workshop, built from workshops.js
workshops.js                # manifest: window.MODULES + window.WORKSHOPS (a script, so it loads on file://)
SETUP.md                    # at-home setup shared by every workshop
images/
  banner.png                # README banner
assets/
  brand/                    # RocketRide wordmark
  fonts/                    # IBM Plex Sans and Mono (SIL OFL), served locally
  tokens.css                # shared color and type tokens
  codelab.css               # codelab layout and components (hub and guides)
  codelab.js                # guide behaviour: step rail, pager, checkpoints, copy buttons
scripts/
  validate.mjs              # zero-dependency repo check (Node 20)
  strip.mjs                 # strips notebook outputs before you commit
modules/
  <id>/
    <id>.ipynb              # the notebook
    index.html              # the project guide (codelab page)
    README.md               # guide link, what it is, time box, requirements
    FACILITATOR.md          # run of show, troubleshooting, skip-ahead guide
```

## Notebook conventions

Every module notebook uses the same Python 3.10+ kernel and the same cell order:

1. **Title and overview** (markdown): what you build, time box, what "done" looks like.
2. **Preflight** (code, tagged `preflight` or starting with a `# Preflight` comment): checks Python and installs the `rocketride` package, plus Node, pnpm and git when the module needs them. Every problem it finds comes with the exact fix. It prints one green "ready" line when everything passes.
3. **Config** (code, tagged `config` or starting with a `# Config` comment): the **only** cell that reads environment variables. It loads `ROCKETRIDE_*` from the environment or a local `.env`, prompts with `getpass` if the key is missing, and exposes a `CONFIG` dict.
4. **Connect** (code, tagged `connect`): one shared `client`, plus `start(pipe_path)`, which attaches to a running pipeline instead of failing with "Pipeline is already running". A module split into parts puts its client and helpers in a **Shared** cell instead (see below).
5. **Stages**: a markdown cell (goal, what to watch for), then short code cells. Each stage ends with a cell headed `# Skip ahead: run this only if the stage above didn't work`, which writes the finished artifact so a stuck attendee can continue.
6. **Deploy** (where it applies): deploys to Cloud and prints the live URL.
7. **What's next** (markdown): docs, Discord and the next module.

Rules:

- **Every cell is safe to re-run.** Writes overwrite, clones skip if the folder exists, and pipelines attach to an existing task.
- **Self-contained.** No imports from sibling files. Anything the notebook needs, it writes itself or fetches in a cell. Generated files go in `build/` next to the notebook.
- **No secrets, no outputs in git.** Run `node scripts/strip.mjs` before you commit.
- Keep code cells short enough to read on a projector.

TypeScript work runs from the same Python kernel, through `%%writefile` cells and shell commands (no TypeScript kernel).

A long module can split into parts. `<id>.ipynb` holds the overview, Preflight, Config and the shared helpers, and each part (`01-….ipynb`, `02-….ipynb`, …) starts with `%run ./<id>.ipynb` followed by `await connect()`. Keep `<id>.ipynb` free of top-level `await`: `%run` can't run it. Parts hand work to each other through files in `build/`, and a part's skip-ahead cell can rewrite its files with the shared `replay()` helper. `specter-mutual` is the example.

## Add a module

1. Create `modules/<id>/` with `<id>.ipynb`, `index.html`, `README.md` and `FACILITATOR.md`. The easiest start is a copy of an existing module. Keep its Preflight, Config and Connect cells as they are. Start `README.md` with a `**Guide:**` link to `https://rocketride-org.github.io/rocketride-workshops/modules/<id>/`.

   The guide (`index.html`) keeps the same phases as every other project: **Start here**, **Set up at home**, **Open the notebook**, the build, the finish (deploy or clean up), and **Words you will hear** as reference. Each phase is a `<section class="phase" data-title="..." data-dur="<minutes>">`. The rail, pager and progress are built by `assets/codelab.js`; give `<body>` a unique `data-key` so progress is saved per guide.
2. Add an entry to `window.MODULES` in `workshops.js`:

   ```js
   "<id>": {
     title: "...",
     summary: "...",
     duration: 10,                       // minutes; workshop totals are computed from these
     notebook: "modules/<id>/<id>.ipynb",
     guide: "modules/<id>/index.html",
     requires: ["python"]                // plus "node", "pnpm", "git" if needed
   }
   ```

3. Clean and check:

   ```sh
   node scripts/strip.mjs
   node scripts/validate.mjs
   ```

## Compose a workshop

A workshop is only a manifest entry. Add it to `window.WORKSHOPS`:

```js
{
  id: "<workshop-id>",
  title: "...",
  summary: "...",
  funnel: "cloud",          // cloud | local
  status: "draft",          // live | draft (drafts show on the hub with ?drafts=1)
  modules: ["alarm-clock", "specter-mutual"]
}
```

Then run `node scripts/validate.mjs`. CI runs the same check on every push and pull request.

## Internal notes

Facilitator material that must not be public goes in `.internal/`, which is gitignored. The validator fails if anything under it, or any `.env` file, is tracked.

# Set up at home

Do this before the workshop. It takes about 15 minutes at home, and much longer on shared venue wifi. Every workshop uses the same setup.

In the room you start each project yourself, in a terminal, and deploy it from the RocketRide extension. Nothing here is scripted for you. The notebooks only hold the build.

## 1. An editor and its extensions

Install one of [VS Code](https://code.visualstudio.com), [Cursor](https://cursor.com) or [Windsurf](https://windsurf.com). You need admin rights on the laptop.

Then install these extensions from the Extensions view (`Cmd+Shift+X` on Mac, `Ctrl+Shift+X` on Windows and Linux):

- **RocketRide**: its App Builder previews, deploys and publishes your apps.
- **Python** (`ms-python.python`)
- **Jupyter** (`ms-toolsai.jupyter`)

## 2. Python 3.10 or newer

```sh
python3 --version    # Windows: python --version
```

If it's older than 3.10, install a current version from [python.org](https://www.python.org/downloads/). You install the `rocketride` package yourself as the first step of each project (`pip install rocketride`). From a clone of this repo, `python3 -m pip install -r requirements.txt` installs everything the notebooks use in one go.

## 3. Node, pnpm and git

| Tool     | Check            | Install                            | Needed for                                              |
| -------- | ---------------- | ---------------------------------- | ------------------------------------------------------- |
| Node 20+ | `node --version` | [nodejs.org](https://nodejs.org)   | Every module: the App Builder runs apps with it          |
| pnpm 10+ | `pnpm --version` | `npm install -g pnpm@latest`       | Every module: `rocketride app create` and the preview    |
| git      | `git --version`  | [git-scm.com](https://git-scm.com) | `notepad-integration`, which clones an existing app      |

Restart your editor after installing them, so its terminals see them. The hub lists what each module requires.

## 4. A RocketRide Cloud account

1. Sign up at RocketRide Cloud and confirm your email.
2. **Start a RocketRide Cloud subscription.** Deploying from the App Builder fails without an active subscription.
3. Find your organization's **developer id**: open the RocketRide App Builder's **Deploy** tab. If your organization hasn't claimed one, an org admin claims it there. You pass it to `rocketride app create`.

## 5. Signing in

You don't create or copy an API key. Each project starts with:

```sh
rocketride init --uri https://api.rocketride.ai
```

The first time, it opens your browser to sign in, then saves a key to `.env` in the project folder and makes git ignore it. The notebooks' RocketRide client reads that `.env` on its own. To sign in again, delete `.env` and run init again.

Never commit a `.env` file or paste a key into a notebook cell.

## 6. Claude Code (alarm clock)

The alarm clock asks [Claude Code](https://claude.com/claude-code) to build the clock. Install it and run `claude` once to sign in. Without it, the module's fallback notebook writes the clock for you.

## 7. Select the right kernel

Open a workshop notebook in VS Code, click **Select Kernel** in the top right, choose **Python Environments**, and pick the Python 3.10+ interpreter where you installed `rocketride`.

TODO(joshua): screenshot of the kernel picker with the right interpreter selected.

If the notebook says `No module named 'rocketride'`, the kernel is pointing at a different Python. Pick the interpreter you ran `pip install rocketride` with.

## 8. Check everything

In an empty folder, run the first two steps of any project:

```sh
pip install rocketride
rocketride init --uri https://api.rocketride.ai
```

If init ends with `Workspace initialized against https://api.rocketride.ai`, you're set. Delete the folder, or keep it for the workshop.

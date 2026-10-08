# Set up at home

Do this before the workshop. It takes about 15 minutes at home, and much longer on shared venue wifi. Every workshop uses the same setup.

## 1. An editor with notebook support

Install one of [VS Code](https://code.visualstudio.com), [Cursor](https://cursor.com) or [Windsurf](https://windsurf.com). You need admin rights on the laptop.

Then install two extensions from the Extensions view (`Cmd+Shift+X` on Mac, `Ctrl+Shift+X` on Windows and Linux):

- **Python** (`ms-python.python`)
- **Jupyter** (`ms-toolsai.jupyter`)

## 2. Python 3.10 or newer

```sh
python3 --version    # Windows: python --version
```

If it's older than 3.10, install a current version from [python.org](https://www.python.org/downloads/). Then install the RocketRide SDK and the notebook kernel:

```sh
python3 -m pip install rocketride ipykernel
```

## 3. Node, pnpm and git (integration modules only)

Modules that work on an existing app, such as `notepad-integration`, also need:

| Tool     | Check            | Install                            |
| -------- | ---------------- | ---------------------------------- |
| Node 20+ | `node --version` | [nodejs.org](https://nodejs.org)   |
| pnpm 10+ | `pnpm --version` | `npm install -g pnpm@latest`       |
| git      | `git --version`  | [git-scm.com](https://git-scm.com) |

The hub lists what each module requires.

## 4. A RocketRide Cloud account

1. Sign up at RocketRide Cloud and confirm your email.
2. **Start a RocketRide Cloud subscription.** Deploying from the notebooks fails without an active subscription.
3. Create an API key and keep it handy.

## 5. Your API key

The notebooks read the key from the `ROCKETRIDE_APIKEY` environment variable, or from a `.env` file in the same folder as the notebook:

```sh
ROCKETRIDE_APIKEY=your-api-key
ROCKETRIDE_URI=https://api.rocketride.ai
```

If neither is set, the notebook's **Config** cell asks for the key when you run it and doesn't save it. Never commit a `.env` file or paste your key into a notebook cell.

## 6. Select the right kernel

Open any workshop notebook in VS Code, click **Select Kernel** in the top right, choose **Python Environments**, and pick the Python 3.10+ interpreter where you installed `rocketride`.

TODO(joshua): screenshot of the kernel picker with the right interpreter selected.

If the notebook says `No module named 'rocketride'`, the kernel is pointing at a different Python. Pick another interpreter, or run `%pip install rocketride ipykernel` in a cell and restart the kernel.

## 7. Check everything

Download your workshop's notebooks from the hub and run the preflight cell in each. If every one prints ready, you're set.

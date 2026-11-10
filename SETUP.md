# Set up at home

Do this before the **Zero to Agent** workshop. It takes about 20 minutes at home, and much longer on venue wifi. Do it all, so the hour in the room is spent building.

Each project guide repeats the setup it needs in its **Set up at home** step. This page puts all of it on one list.

## 1. Tools

Install whatever you don't already have:

- An editor: [VS Code](https://code.visualstudio.com), [Cursor](https://cursor.com) or [Windsurf](https://windsurf.com)
- [Node 20 or newer](https://nodejs.org)
- [git](https://git-scm.com)
- [Claude Code](https://claude.com/claude-code). It needs a Claude Pro or Max plan, or an Anthropic Console account. Run `claude` once to sign in, then type `/exit`.

Then open a terminal (**Terminal** on Mac and Linux, **PowerShell** on Windows) and run:

```sh
npm install -g pnpm@latest yarn rocketride@latest
```

Close the terminal and open a new one, then check:

```sh
node --version
pnpm --version
yarn --version
rocketride --version
git --version
```

You should see Node `v20` or higher, pnpm `10` or higher, Yarn `1.x`, RocketRide `1.6.0` or higher, and any git.

- **Mac or Linux, `EACCES: permission denied`:** put `sudo` in front of the install command.
- **Windows, `running scripts is disabled on this system`:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, then open a new PowerShell.

Finally, in your editor, open Extensions (`Cmd+Shift+X` on Mac, `Ctrl+Shift+X` on Windows and Linux), search **RocketRide** and click **Install**. Specter Mutual uses it.

## 2. RocketRide Cloud account

1. [Sign up for RocketRide Cloud](https://auth.rocketride.ai/ui/v2/login/register) and confirm your email.
2. On your desktop at [cloud.rocketride.ai](https://cloud.rocketride.ai), find the **Have a promo code?** bar at the bottom. Enter `EXCALIDRAW_WALKTHROUGH` and click **Redeem**. The code activates your plan, so you don't need to buy a subscription.

Your new account is its own organization, and you are its admin.

## 3. Developer id

Every app id starts with your developer id, for example `yourname_dev.kanban`. Sign in, then claim one. Pick something like `yourname_dev`, using letters and underscores. You can't rename it later.

```sh
rocketride login --uri https://api.rocketride.ai
rocketride app developer register yourname_dev
```

## 4. Anthropic key (Excalidraw and Specter Mutual)

1. Create an API key at [console.anthropic.com](https://console.anthropic.com). The account needs a few dollars of credit. The key starts with `sk-ant-api03-`.
2. At [cloud.rocketride.ai](https://cloud.rocketride.ai), open the menu at the bottom of the sidebar, then **Settings → Environment Variables**.
3. Add a user variable named `ROCKETRIDE_ANTHROPIC_KEY`, with your key as the value.

Your agents read the key from RocketRide Cloud, so it never sits on your laptop.

## 5. Download Excalidraw (about 900 MB)

This is the slow part. Do it at home:

```sh
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
git checkout 701b901
yarn workspace excalidraw-app add rocketride@1.6.0
```

The last command installs Excalidraw and the RocketRide SDK. It ends with `Done`. Remember where the `excalidraw` folder is.

## Ready

- [ ] Five version numbers in the terminal, and the RocketRide extension installed
- [ ] Signed up, email confirmed, workshop code redeemed
- [ ] Developer id claimed
- [ ] `ROCKETRIDE_ANTHROPIC_KEY` saved in RocketRide Cloud
- [ ] An `excalidraw` folder with its packages installed

Stuck? Ask in the [RocketRide Discord](https://discord.gg/PMXrtenMsY), or come 10 minutes early for the help desk.

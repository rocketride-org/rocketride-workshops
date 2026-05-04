# @rocketride/runtime (`launchpad`)

Tiny CLI used by every workshop project to download, cache, and run the Rocketride runtime locally.

It is **not** the Rocketride runtime itself — it just fetches the right release artifact from [`rocketride-org/rocketride-server`](https://github.com/rocketride-org/rocketride-server/releases) and starts it.

## Commands

```sh
launchpad install   # download + extract runtime into ./.dependencies/rocketride (idempotent)
launchpad update    # force re-download
launchpad start     # spawn the engine binary from ./.dependencies/rocketride
```

All commands operate on the project that invoked them — they look at `package.json` in `process.env.INIT_CWD` (set by pnpm/npm) or the current working directory.

## How it picks a version

Each consuming project's `package.json`:

```json
{
  "rocketride": { "runtime": "latest" }
}
```

- `"latest"` — queries the GitHub API for the newest non-prerelease `server-vX.Y.Z` tag.
- `"3.1.2"` / `"v3.1.2"` / `"server-v3.1.2"` — explicit version.

## How it picks an asset

Server releases publish per-OS archives. `launchpad` matches `process.platform` + `process.arch`:

| Platform | Asset |
|---|---|
| `darwin` + `arm64` | `rocketride-server-vX.Y.Z-darwin-arm64.tar.gz` |
| `linux` + `x64` | `rocketride-server-vX.Y.Z-linux-x64.tar.gz` |
| `win32` + `x64` | `rocketride-server-vX.Y.Z-win64.zip` |

Other platforms throw — file an issue or send a PR.

## Idempotency

After a successful install, `launchpad` writes the resolved version to `./.dependencies/rocketride/.version`. Subsequent `launchpad install` runs that match that version are no-ops.

## Auth (optional)

Set `GITHUB_TOKEN` to lift the unauthenticated GitHub API rate limit (60/hr → 5000/hr). Useful in CI; rarely needed locally.

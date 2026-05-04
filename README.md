<div align="center">

<a href="https://rocketride.org">
  <img src="./images/banner-root.svg" alt="RocketRide Workshops" width="100%">
</a>

<p>
  Public, hands-on workshops for the RocketRide AI runtime.<br/>
  Build real apps that integrate RocketRide — UI, API, and the runtime, end to end.
</p>

<p>
  Each workshop is a self-contained project pairing a scaffolded <code>exercise/</code> for attendees with a fully-wired <code>solution/</code> reference. Workshops focus on RocketRide integration: pipeline definitions, SDK calls, and runtime orchestration. The surrounding stack (Vite + React, FastAPI, etc.) is intentionally minimal so the spotlight stays on RocketRide.
</p>

<p>
  <img src="./images/icon-python.png" height="28" alt="Python" />&nbsp;&nbsp;
  <img src="./images/icon-typescript.png" height="28" alt="TypeScript" />
</p>

<p>
  <a href="https://rocketride.org">Home</a> |
  <a href="https://docs.rocketride.org/">Documentation</a> |
  <a href="https://pypi.org/project/rocketride/">Python SDK</a> |
  <a href="https://www.npmjs.com/package/rocketride">TypeScript SDK</a> |
  <a href="https://pypi.org/project/rocketride-mcp/">MCP Server</a>
</p>

<p>
  <a href="https://github.com/rocketride-org/rocketride-workshops/actions/workflows/ci.yml"><img src="https://github.com/rocketride-org/rocketride-workshops/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/rocketride-org/rocketride-server/releases/tag/server-v3.1.2"><img src="https://img.shields.io/badge/engine-v3.1.2-5f2167?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTEgMTkxIj48cGF0aCBkPSJNMTU5LjUgMTYxLjRMMTUzLjcgMTY3LjJDMTUxLjkgMTY5IDE0OC45IDE2OSAxNDcgMTY3LjJMMTI2LjYgMTQ2LjhDMTE1LjYgMTM1LjggMTE1LjYgMTE4IDEyNi42IDEwN0MxMzguMSA5NS41IDEzOC4xIDc2LjkgMTI2LjYgNjUuNEwxMjUuMSA2My45QzExMy42IDUyLjQgOTUgNTIuNCA4My41IDYzLjlDNzIuNSA3NC45IDU0LjYgNzQuOSA0My42IDYzLjlMMjMuMiA0My41QzIxLjQgNDEuNyAyMS40IDM4LjcgMjMuMiAzNi44TDI5IDMxQzM3IDIzIDQ5LjEgMjAuNSA1OS42IDI0LjlMODcuNSAzNi4zQzk3LjMgNDAuMSAxMDguNCAzOCAxMTYuMyAzMS4xTDEzNyAxMC40QzEzOC42IDguOSAxNDAuNCA3LjQgMTQyLjUgNi4yQzE0Ni4yIDQuMSAxNTAuMyAzIDE1NC41IDIuNkwxODUuNCAwQzE4OC4zLS4zIDE5MC44IDIuMiAxOTAuNSA1LjFMMTg3LjggMzYuNEMxODcuMyA0Mi44IDE4NC41IDQ4LjggMTgwLjEgNTMuNUwxNjAuNSA3My4xQzE1Mi41IDgxLjIgMTUwLjEgOTMuMyAxNTQuNSAxMDMuOEwxNTUuNSAxMDYuMkwxNjEuMiAxMjBMMTY1LjYgMTMwLjlDMTY5LjkgMTQxLjQgMTY3LjUgMTUzLjUgMTU5LjUgMTYxLjVaIiBmaWxsPSJ3aGl0ZSIvPjxwYXRoIGQ9Ik0uOCAxOTAuM0MtLjIgMTg5LjMtLjMgMTg3LjYuNiAxODYuNEwyMS4xIDE2MkMzMS4xIDE1MCAzNy45IDEzNy43IDQxLjMgMTI1LjNDNDMuNiAxMTYuNiA0NC42IDEwOC41IDQ0LjEgMTAxLjJDNDQuMSAxMDAuMyA0NC40IDk5LjQgNDUuMSA5OC44QzQ1LjggOTguMiA0Ni44IDk3LjkgNDcuNyA5OC4xQzY1IDEwMS42IDgzLjUgOTguMyA5OC41IDg4LjlDOTkuNiA4OC4yIDEwMS4xIDg4LjQgMTAyIDg5LjNDMTAyLjkgOTAuMiAxMDMuMSA5MS43IDEwMi40IDkyLjhDOTMgMTA3LjggODkuNyAxMjYuMyA5My4yIDE0My41QzkzLjQgMTQ0LjMgOTMuMiAxNDUuMiA5Mi42IDE0NS45QzkyIDE0Ni42IDkxIDE0Ny4yIDkwLjEgMTQ3LjFDODIuOCAxNDYuNiA3NC42IDE0Ny41IDY2IDE0OS45QzUzLjYgMTUzLjIgNDEuMiAxNjAgMjkuMyAxNzAuMUw0LjkgMTkwLjZDMy44IDE5MS41IDIuMSAxOTEuNSAxIDE5MC40SC44WiIgZmlsbD0iI0Y5MzgyMiIvPjwvc3ZnPgo=" alt="Engine v3.1.2"></a>
  <a href="https://discord.gg/9hr3tdZmEG"><img src="https://img.shields.io/badge/Discord-Join-370b7a?logo=discord&logoColor=white" alt="Discord"></a>
</p>

</div>

## Prerequisites

| Tool                                        | Version    | Purpose                                                                                                                          |
| ------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [Node.js](https://nodejs.org)               | `>=20`     | Runtime for pnpm and Vite tooling                                                                                                |
| [pnpm](https://pnpm.io)                     | `>=9`      | Workspace and package manager                                                                                                    |
| [Python](https://www.python.org/downloads/) | `>=3.11`   | Runs each workshop's API                                                                                                         |
| [uv](https://docs.astral.sh/uv/)            | latest     | Python environment + dependency manager                                                                                          |
| [Git](https://git-scm.com/)                 | any        | Clone the repository                                                                                                             |
| `libc++`                                    | Linux only | The bundled `engine` binary links against `libc++.so.1` — `apt install libc++1` on Debian/Ubuntu, `dnf install libcxx` on Fedora |

## Setup

1. Clone the repository.

   ```sh
   git clone https://github.com/rocketride-org/rocketride-workshops.git
   cd rocketride-workshops
   ```

2. Install everything in one command. Per-workshop `postinstall` hooks download the RocketRide runtime and sync Python dependencies — no follow-up steps required.

   ```sh
   pnpm install
   ```

3. Pick a workshop and boot UI + API + runtime together.

   ```sh
   cd workshops/coding-agent/solution
   pnpm dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) — the UI calls `/api/hello`, which exercises the wired RocketRide pipeline.

## Workshops

| Workshop                                 | Stack                           | Status                                   |
| ---------------------------------------- | ------------------------------- | ---------------------------------------- |
| [coding-agent](./workshops/coding-agent) | Python · FastAPI · Vite + React | Scaffolding ready · workshop content WIP |

Each workshop ships paired directories:

- `exercise/` — scaffolded project with TODO stubs. Attendees fill these in.
- `solution/` — fully-wired reference implementation.

## How `@rocketride/runtime` works

Each workshop project's `package.json` declares the runtime version:

```json
{
  "rocketride": { "runtime": "latest" },
  "scripts": { "postinstall": "launchpad install && uv sync --directory api --all-groups" }
}
```

`launchpad install` resolves `latest` against the [`rocketride-server`](https://github.com/rocketride-org/rocketride-server/releases) GitHub releases, picks the asset for your OS (`darwin-arm64`, `linux-x64`, or `win64`), extracts it to `./.dependencies/rocketride/`, and records the version for idempotent re-installs. `launchpad start` (run by each workshop's `runtime/` sub-package) launches the extracted `engine` binary against `ai/eaas.py`.

See [`tools/launchpad/README.md`](./tools/launchpad/README.md) for details.

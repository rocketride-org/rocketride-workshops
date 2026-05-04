#!/usr/bin/env node
/**
 * End-to-end smoke test: starts `pnpm dev` for a workshop's solution,
 * polls the UI's vite proxy by POSTing to /api/chat until it responds,
 * asserts the payload echoes the stub reply, then shuts everything down.
 *
 * Cross-platform: uses tree-kill to terminate the process group on Windows
 * (where SIGTERM doesn't reliably reach pnpm's grandchildren).
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PROJECT = process.env.E2E_PROJECT ?? "workshops/coding-agent/solution";
const UI_URL = "http://localhost:5173";
const CHAT_URL = `${UI_URL}/api/chat`;
const PROBE_MESSAGE = "ci-smoke";
const EXPECTED_REPLY = `stub: ${PROBE_MESSAGE}`;
const READY_TIMEOUT_MS = 90_000;
const SHUTDOWN_TIMEOUT_MS = 15_000;

const isWindows = process.platform === "win32";

console.log(`e2e: starting \`pnpm dev\` in ${PROJECT}`);
const child = spawn("pnpm", ["dev"], {
  cwd: PROJECT,
  stdio: ["ignore", "inherit", "inherit"],
  shell: isWindows,
  env: process.env,
  detached: !isWindows,
});

let exited = false;
child.on("exit", (code, signal) => {
  exited = true;
  console.log(`e2e: dev process exited code=${code} signal=${signal}`);
});

const cleanup = async (exitCode) => {
  if (!exited) {
    console.log("e2e: shutting down dev process tree");
    await killTree(child.pid).catch((err) => console.error("e2e: kill error", err));
  }
  const start = Date.now();
  while (!exited && Date.now() - start < SHUTDOWN_TIMEOUT_MS) {
    await sleep(200);
  }
  if (!exited) {
    console.error("e2e: dev process did not exit within shutdown timeout");
    exitCode = exitCode || 1;
  } else {
    console.log("e2e: dev process tree stopped cleanly");
  }
  process.exit(exitCode);
};

process.on("SIGINT", () => cleanup(130));
process.on("SIGTERM", () => cleanup(143));

try {
  await waitForChat();
  console.log("e2e: smoke test passed");
  await cleanup(0);
} catch (err) {
  console.error("e2e: FAIL", err.message ?? err);
  await cleanup(1);
}

async function waitForChat() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    if (exited) throw new Error("dev process exited before /api/chat responded");
    try {
      const r = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: PROBE_MESSAGE }),
      });
      if (r.ok) {
        const body = await r.json();
        if (body?.reply !== EXPECTED_REPLY) {
          throw new Error(`unexpected body: ${JSON.stringify(body)}`);
        }
        console.log(`e2e: ${CHAT_URL} → ${JSON.stringify(body)}`);
        return;
      }
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(1000);
  }
  throw new Error(
    `/api/chat did not return expected payload within ${READY_TIMEOUT_MS / 1000}s: ${lastErr?.message ?? "unknown"}`,
  );
}

async function killTree(pid) {
  if (!pid) return;
  if (isWindows) {
    await new Promise((resolveKill) => {
      const k = spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
      k.on("exit", () => resolveKill());
      k.on("error", () => resolveKill());
    });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  }
}

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { findProjectRoot } from "./version.mjs";

const CANDIDATE_BINARIES = process.platform === "win32" ? ["engine.exe"] : ["engine"];

const DEFAULT_ENTRY_SCRIPT = join("ai", "eaas.py");

export async function start(args = []) {
  const { dir: projectDir } = await findProjectRoot();
  const depsDir = process.env.ROCKETRIDE_RUNTIME_DIR
    ? resolve(process.env.ROCKETRIDE_RUNTIME_DIR)
    : resolve(projectDir, ".dependencies", "rocketride");

  const binary = await resolveEngineBinary(depsDir);
  const engineArgs = args.length > 0 ? args : [DEFAULT_ENTRY_SCRIPT];

  console.log(`launchpad: starting ${binary} ${engineArgs.join(" ")}`);

  const child = spawn(binary, engineArgs, {
    cwd: depsDir,
    stdio: "inherit",
    env: process.env,
  });

  const forward = (sig) => () => child.kill(sig);
  process.on("SIGINT", forward("SIGINT"));
  process.on("SIGTERM", forward("SIGTERM"));

  await new Promise((resolvePromise, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
      resolvePromise();
    });
  });
}

async function resolveEngineBinary(depsDir) {
  for (const name of CANDIDATE_BINARIES) {
    const candidate = resolve(depsDir, name);
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    `No runtime binary found in ${depsDir}. ` +
      `Looked for: ${CANDIDATE_BINARIES.join(", ")}. ` +
      `Run \`launchpad install\` first.`,
  );
}

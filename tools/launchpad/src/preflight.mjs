import { spawn } from "node:child_process";
import { open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE_MANAGERS = [
  {
    pm: "apt-get",
    install: ["apt-get", "install", "-y", "libc++1", "libc++abi1", "llvm-libunwind1"],
  },
  {
    pm: "dnf",
    install: ["dnf", "install", "-y", "libcxx", "libcxxabi", "llvm-libunwind"],
  },
  {
    pm: "pacman",
    install: ["pacman", "-S", "--noconfirm", "libc++", "libc++abi", "llvm-libunwind"],
  },
  {
    pm: "zypper",
    install: ["zypper", "install", "-y", "libc++1", "libc++abi1", "llvm-libunwind"],
  },
];

const LOCK_PATH = join(tmpdir(), "launchpad-native-install.lock");
const LOCK_POLL_MS = 1000;
const LOCK_TIMEOUT_MS = 120_000;

export async function verifyNativeDeps(enginePath, { mode }) {
  if (process.platform !== "linux") return { ok: true, missing: [] };

  let missing = await lddMissing(enginePath);
  if (missing.length === 0) {
    console.log("launchpad: native deps OK");
    return { ok: true, missing: [] };
  }

  const pmEntry = await detectPackageManager();
  const hintCommand = pmEntry ? pmEntry.install.join(" ") : null;

  console.error(
    `launchpad: engine is missing native libraries on this system:\n  ${missing.join("\n  ")}`,
  );

  if (mode === "start") {
    printHint(pmEntry, missing);
    return { ok: false, missing, pm: pmEntry?.pm ?? null, command: hintCommand };
  }

  if (!pmEntry) {
    printHint(null, missing);
    return { ok: false, missing, pm: null, command: null };
  }

  if (!(await canSudoNonInteractive())) {
    console.error("launchpad: passwordless sudo unavailable, skipping auto-install.");
    printHint(pmEntry, missing);
    return { ok: false, missing, pm: pmEntry.pm, command: hintCommand };
  }

  return await withGlobalLock(async () => {
    missing = await lddMissing(enginePath);
    if (missing.length === 0) {
      console.log("launchpad: native deps installed by a sibling workspace");
      return { ok: true, missing: [], pm: pmEntry.pm, command: hintCommand };
    }

    const argv = wrapWithSudo(pmEntry.install);
    console.log(`launchpad: installing native deps via: ${argv.join(" ")}`);

    const installOk = await runCommand(argv);
    if (!installOk) {
      console.error("launchpad: auto-install failed.");
      printHint(pmEntry, missing);
      return { ok: false, missing, pm: pmEntry.pm, command: hintCommand };
    }

    const stillMissing = await lddMissing(enginePath);
    if (stillMissing.length > 0) {
      console.error(`launchpad: still missing after install:\n  ${stillMissing.join("\n  ")}`);
      printHint(pmEntry, stillMissing);
      return { ok: false, missing: stillMissing, pm: pmEntry.pm, command: hintCommand };
    }

    console.log("launchpad: native deps installed");
    return { ok: true, missing: [], pm: pmEntry.pm, command: hintCommand };
  });
}

async function lddMissing(enginePath) {
  const { stdout, code } = await captureCommand(["ldd", enginePath]);
  if (code !== 0 && !stdout) return [];

  const missing = new Set();
  for (const line of stdout.split("\n")) {
    const match = line.match(/^\s*(\S+\.so(?:\.\d+)*)\s*=>\s*not found/);
    if (match) missing.add(match[1]);
  }
  return [...missing];
}

async function detectPackageManager() {
  for (const entry of PACKAGE_MANAGERS) {
    if (await isOnPath(entry.pm)) return entry;
  }
  return null;
}

async function isOnPath(cmd) {
  const { code } = await captureCommand(["sh", "-c", `command -v ${cmd}`]);
  return code === 0;
}

async function canSudoNonInteractive() {
  if (typeof process.geteuid === "function" && process.geteuid() === 0) return true;
  if (!(await isOnPath("sudo"))) return false;
  const { code } = await captureCommand(["sudo", "-n", "true"]);
  return code === 0;
}

function wrapWithSudo(argv) {
  if (typeof process.geteuid === "function" && process.geteuid() === 0) return argv;
  return ["sudo", "-n", ...argv];
}

async function runCommand(argv) {
  return await new Promise((resolvePromise) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: "inherit" });
    child.on("error", () => resolvePromise(false));
    child.on("exit", (code) => resolvePromise(code === 0));
  });
}

async function captureCommand(argv) {
  return await new Promise((resolvePromise) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", () => resolvePromise({ stdout: "", stderr: "", code: -1 }));
    child.on("exit", (code) => resolvePromise({ stdout, stderr, code: code ?? -1 }));
  });
}

async function withGlobalLock(fn) {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let handle = null;
  while (Date.now() < deadline) {
    try {
      handle = await open(LOCK_PATH, "wx");
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      await sleep(LOCK_POLL_MS);
    }
  }
  if (!handle) throw new Error(`Timed out waiting on ${LOCK_PATH}`);
  try {
    return await fn();
  } finally {
    await handle.close();
    await rm(LOCK_PATH, { force: true });
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function printHint(pmEntry, missing) {
  if (pmEntry) {
    console.error(`launchpad: install them with:\n  sudo ${pmEntry.install.join(" ")}`);
    return;
  }
  console.error(
    `launchpad: no supported package manager (apt-get/dnf/pacman/zypper) detected.\n` +
      `Install the following shared libraries manually before running \`pnpm dev\`:\n  ${missing.join("\n  ")}`,
  );
}

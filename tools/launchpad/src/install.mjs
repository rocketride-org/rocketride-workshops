import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { extract as extractTar } from "tar";
import extractZip from "extract-zip";
import { findProjectRoot, getReleaseAssets, pickAsset, resolveVersion } from "./version.mjs";
import { verifyNativeDeps } from "./preflight.mjs";

export async function install({ force = false } = {}) {
  const { dir: projectDir, spec } = await findProjectRoot();
  const depsDir = resolve(projectDir, "runtime", ".rocketride");
  const versionFile = resolve(depsDir, ".version");

  console.log(`launchpad: project ${projectDir}`);
  console.log(`launchpad: requested runtime = ${spec}`);

  const version = await resolveVersion(spec);
  console.log(`launchpad: resolved runtime = v${version}`);

  const installed = !force && (await readVersionFile(versionFile)) === version;

  if (installed) {
    console.log(`launchpad: runtime v${version} already installed at ${depsDir}. Skipping.`);
  } else {
    const { tag, assets } = await getReleaseAssets(version);
    const { asset, kind } = pickAsset(assets, version);

    console.log(`launchpad: downloading ${asset.name} (${formatBytes(asset.size)}) from ${tag}`);

    const tmpFile = resolve(tmpdir(), `launchpad-${randomBytes(6).toString("hex")}.${kind}`);
    await downloadFile(asset.browser_download_url, tmpFile);

    await rm(depsDir, { recursive: true, force: true });
    await mkdir(depsDir, { recursive: true });

    if (kind === "tar") {
      await extractTar({ file: tmpFile, cwd: depsDir });
    } else {
      await extractZip(tmpFile, { dir: depsDir });
    }
    await rm(tmpFile, { force: true });

    await writeFile(versionFile, version, "utf8");
    console.log(`launchpad: runtime v${version} installed at ${depsDir}`);
  }

  const engineBinary = resolve(depsDir, process.platform === "win32" ? "engine.exe" : "engine");
  const preflight = await verifyNativeDeps(engineBinary, { mode: "install" });
  if (!preflight.ok) process.exit(1);

  await ensureRuntimePythonBuildDeps(projectDir, depsDir);
}

async function ensureRuntimePythonBuildDeps(projectDir, depsDir) {
  const uvBin = await findWorkspaceUv(projectDir);
  if (!uvBin) {
    console.warn(`launchpad: workspace uv not found, skipping setuptools install`);
    console.warn(`launchpad: ensure @manzt/uv is a devDependency so the engine bootstrap works`);
    return;
  }

  const libDir = resolve(depsDir, "lib");
  let sitePackages;
  try {
    const entries = await readdir(libDir);
    const pyDir = entries.find((e) => /^python\d+\.\d+$/.test(e));
    if (!pyDir) {
      console.warn(
        `launchpad: no python<version> dir under ${libDir}, skipping setuptools install`,
      );
      return;
    }
    sitePackages = resolve(libDir, pyDir, "site-packages");
  } catch {
    console.warn(`launchpad: could not read ${libDir}, skipping setuptools install`);
    return;
  }

  console.log("launchpad: ensuring setuptools is available in runtime python");
  const ok = await new Promise((resolvePromise) => {
    const child = spawn(
      uvBin,
      ["pip", "install", "--target", sitePackages, "--quiet", "setuptools"],
      { stdio: "inherit" },
    );
    child.on("error", () => resolvePromise(false));
    child.on("exit", (code) => resolvePromise(code === 0));
  });

  if (!ok) {
    console.warn("launchpad: failed to install setuptools into runtime python");
    console.warn("launchpad: engine may fail to compile dependency constraints on first start");
  }
}

async function findWorkspaceUv(projectDir) {
  const uvName = process.platform === "win32" ? "uv.cmd" : "uv";
  const candidate = resolve(projectDir, "node_modules", ".bin", uvName);
  try {
    await access(candidate);
    return candidate;
  } catch {
    return null;
  }
}

async function readVersionFile(versionFile) {
  try {
    return (await readFile(versionFile, "utf8")).trim();
  } catch {
    return null;
  }
}

async function downloadFile(url, destPath) {
  await mkdir(dirname(destPath), { recursive: true });
  const headers = { "User-Agent": "rocketride-launchpad" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
  }
  await pipeline(res.body, createWriteStream(destPath));
}

function formatBytes(bytes) {
  if (!bytes) return "?";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  return `${value.toFixed(1)} ${units[unitIdx]}`;
}

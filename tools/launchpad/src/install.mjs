import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { extract as extractTar } from "tar";
import extractZip from "extract-zip";
import { findProjectRoot, getReleaseAssets, pickAsset, resolveVersion } from "./version.mjs";

export async function install({ force = false } = {}) {
  const { dir: projectDir, spec } = await findProjectRoot();
  const depsDir = resolve(projectDir, "runtime", ".rocketride");
  const versionFile = resolve(depsDir, ".version");

  console.log(`launchpad: project ${projectDir}`);
  console.log(`launchpad: requested runtime = ${spec}`);

  const version = await resolveVersion(spec);
  console.log(`launchpad: resolved runtime = v${version}`);

  if (!force) {
    const installed = await readVersionFile(versionFile);
    if (installed === version) {
      console.log(`launchpad: runtime v${version} already installed at ${depsDir}. Skipping.`);
      return;
    }
  }

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

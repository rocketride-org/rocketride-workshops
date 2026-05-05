import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const REPO = "rocketride-org/rocketride-server";
const SERVER_TAG_PREFIX = "server-v";

export async function findProjectRoot(startDir = process.cwd()) {
  let current = resolve(startDir);
  while (true) {
    const pkgPath = resolve(current, "package.json");
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
      if (pkg?.rocketride?.runtime) {
        return { dir: current, spec: String(pkg.rocketride.runtime).trim() };
      }
    } catch {
      /* keep walking */
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        `Could not find a package.json with a \`rocketride.runtime\` field walking up from ${startDir}.`,
      );
    }
    current = parent;
  }
}

export async function resolveVersion(spec) {
  const normalized = normalize(spec);
  if (normalized !== "latest") return normalized;
  return await fetchLatestServerTag();
}

function normalize(spec) {
  if (!spec) return "latest";
  if (spec === "latest") return "latest";
  if (spec.startsWith(SERVER_TAG_PREFIX)) return spec.slice(SERVER_TAG_PREFIX.length);
  if (spec.startsWith("v")) return spec.slice(1);
  return spec;
}

async function fetchLatestServerTag() {
  const releases = await ghJson(`https://api.github.com/repos/${REPO}/releases?per_page=100`);
  const serverReleases = releases
    .filter((r) => !r.prerelease && !r.draft)
    .filter((r) => r.tag_name?.startsWith(SERVER_TAG_PREFIX))
    .map((r) => ({
      tag: r.tag_name,
      version: r.tag_name.slice(SERVER_TAG_PREFIX.length),
      publishedAt: r.published_at,
    }))
    .sort((a, b) => compareSemver(b.version, a.version));

  if (serverReleases.length === 0) {
    throw new Error(`No \`${SERVER_TAG_PREFIX}*\` releases found at github.com/${REPO}.`);
  }
  return serverReleases[0].version;
}

function compareSemver(a, b) {
  const parse = (v) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  return aMaj - bMaj || aMin - bMin || aPat - bPat;
}

export async function getReleaseAssets(version) {
  const tag = `${SERVER_TAG_PREFIX}${version}`;
  const release = await ghJson(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`);
  return { tag, assets: release.assets ?? [] };
}

async function ghJson(url) {
  const headers = { "User-Agent": "rocketride-launchpad", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${url}\n${body.slice(0, 500)}`);
  }
  return res.json();
}

export function pickAsset(assets, version) {
  const platformKey = currentPlatformKey();
  const assetVersion = baseSemver(version);
  const target = `rocketride-server-v${assetVersion}-${platformKey.name}.${platformKey.ext}`;
  const asset = assets.find((a) => a.name === target);
  if (!asset) {
    const names = assets.map((a) => a.name).join(", ");
    throw new Error(`No release asset matched \`${target}\`. Available: ${names || "(none)"}.`);
  }
  return { asset, ...platformKey };
}

function baseSemver(version) {
  return version.replace(/[-+].+$/, "");
}

export function currentPlatformKey() {
  const { platform, arch } = process;
  if (platform === "win32") return { name: "win64", ext: "zip", kind: "zip" };
  if (platform === "linux" && (arch === "x64" || arch === "x86_64"))
    return { name: "linux-x64", ext: "tar.gz", kind: "tar" };
  if (platform === "darwin" && arch === "arm64")
    return { name: "darwin-arm64", ext: "tar.gz", kind: "tar" };
  throw new Error(
    `Unsupported platform/arch: ${platform}/${arch}. ` +
      `Rocketride server publishes win64, linux-x64, darwin-arm64.`,
  );
}

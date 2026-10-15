#!/usr/bin/env node
// Zero-dependency repo check (Node 20). Run from anywhere: node scripts/validate.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);
const rel = (p) => relative(root, p).split("\\").join("/");

// 1. Manifest
let MODULES = {};
let WORKSHOPS = [];
try {
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(root, "workshops.js"), "utf8"), sandbox);
  MODULES = sandbox.window.MODULES ?? {};
  WORKSHOPS = sandbox.window.WORKSHOPS ?? [];
  if (typeof MODULES !== "object" || Array.isArray(MODULES))
    throw new Error("window.MODULES is not an object");
  if (!Array.isArray(WORKSHOPS)) throw new Error("window.WORKSHOPS is not an array");
} catch (e) {
  fail(`workshops.js: ${e.message}`);
}
for (const [id, m] of Object.entries(MODULES)) {
  if (!m.notebook) fail(`workshops.js: module "${id}" has no notebook`);
  else if (!existsSync(join(root, m.notebook)))
    fail(`workshops.js: module "${id}" notebook does not exist: ${m.notebook}`);
  if (m.guide && !existsSync(join(root, m.guide)))
    fail(`workshops.js: module "${id}" guide does not exist: ${m.guide}`);
  if (typeof m.duration !== "number")
    fail(`workshops.js: module "${id}" duration must be a number of minutes`);
}
for (const w of WORKSHOPS) {
  for (const id of w.modules ?? []) {
    if (!MODULES[id]) fail(`workshops.js: workshop "${w.id}" references unknown module "${id}"`);
  }
}

// 2. Module folders
const modulesDir = join(root, "modules");
const folders = existsSync(modulesDir)
  ? readdirSync(modulesDir).filter((d) => statSync(join(modulesDir, d)).isDirectory())
  : [];
for (const d of folders) {
  if (!MODULES[d]) fail(`modules/${d}: not listed in window.MODULES`);
  for (const f of ["README.md", "FACILITATOR.md", "index.html", `${d}.ipynb`]) {
    if (!existsSync(join(modulesDir, d, f))) fail(`modules/${d}: missing ${f}`);
  }
}

// 3. Notebooks
const SECRET = /sk-ant-[A-Za-z0-9_-]{8,}|rr_[A-Za-z0-9]{16,}|ROCKETRIDE_[A-Z_]*=\S+/;
const ENV_ACCESS = /os\.environ|getenv/;
// Participants install, scaffold and deploy by hand from the guide; notebooks hold only the build.
const SETUP_CODE =
  /%pip|pip install|rocketride init|app create|create_app\(|verify_app\(|add_app\(|publish_app\(|"pnpm"|"git", "clone"/;
const src = (cell) => (Array.isArray(cell.source) ? cell.source.join("") : (cell.source ?? ""));

// Every notebook in a module folder is checked.
const moduleNotebooks = folders.flatMap((d) =>
  readdirSync(join(modulesDir, d))
    .filter((f) => f.endsWith(".ipynb"))
    .map((f) => join(modulesDir, d, f)),
);

for (const file of moduleNotebooks) {
  const name = rel(file);
  const raw = readFileSync(file, "utf8");
  let nb;
  try {
    nb = JSON.parse(raw);
  } catch (e) {
    fail(`${name}: not valid JSON (${e.message})`);
    continue;
  }
  if (nb.nbformat !== 4 || !Array.isArray(nb.cells)) {
    fail(`${name}: not an nbformat 4 notebook`);
    continue;
  }
  if (SECRET.test(raw)) fail(`${name}: contains something that looks like an API key`);
  nb.cells.forEach((cell, i) => {
    if (cell.cell_type !== "code") return;
    if ((cell.outputs ?? []).length)
      fail(`${name}: cell ${i} has outputs (run node scripts/strip.mjs)`);
    if (cell.execution_count != null)
      fail(`${name}: cell ${i} has an execution_count (run node scripts/strip.mjs)`);
    if (ENV_ACCESS.test(src(cell))) {
      fail(`${name}: cell ${i} reads environment variables; the SDK reads the .env that rocketride init writes`);
    }
    const setup = src(cell).match(SETUP_CODE);
    if (setup) {
      fail(`${name}: cell ${i} runs "${setup[0]}"; installs, scaffolding and deploys belong in the guide, done by hand`);
    }
  });
}

// 4. Relative links in every HTML and CSS file resolve
if (!existsSync(join(root, "index.html"))) fail("index.html: missing");
// notepad-starter is the app notepad-integration clones next to its notebook (gitignored).
const skip = new Set(["node_modules", ".git", ".internal", "build", "notepad-starter"]);
function walk(dir, ext, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name) || (name.startsWith(".") && name !== ".github")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext)) out.push(p);
  }
  return out;
}
const isExternal = (u) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
function checkRefs(file, refs) {
  for (const ref of refs) {
    if (isExternal(ref)) continue;
    const target = decodeURI(ref.split(/[?#]/)[0]);
    if (target && !existsSync(resolve(dirname(file), target)))
      fail(`${rel(file)}: broken link ${ref}`);
  }
}
const htmlFiles = walk(root, ".html");
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  checkRefs(file, [...html.matchAll(/\s(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));
}
const remote = /^(https?:)?\/\//i;
for (const file of walk(root, ".css")) {
  const refs = [...readFileSync(file, "utf8").matchAll(/url\(\s*["']?([^"')\s]+)/gi)].map((m) => m[1]);
  for (const ref of refs) if (remote.test(ref)) fail(`${rel(file)}: external CSS resource ${ref}`);
  checkRefs(file, refs);
}

// 5. No external resources or fetch() in any HTML file
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    if (remote.test(m[1])) fail(`${rel(file)}: external script ${m[1]}`);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = m[0].match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    if (/rel\s*=\s*["']?[^"'>]*(stylesheet|preload|font|icon)/i.test(m[0]) && remote.test(href)) {
      fail(`${rel(file)}: external stylesheet/font ${href}`);
    }
  }
  for (const m of html.matchAll(/(?:@import\s+(?:url\()?|url\()\s*["']?([^"')\s;]+)/gi)) {
    if (remote.test(m[1])) fail(`${rel(file)}: external CSS resource ${m[1]}`);
  }
  if (html.includes("fetch(")) fail(`${rel(file)}: contains fetch(`);
}

// 6. Nothing secret or internal is tracked
try {
  const tracked = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
    .split("\n")
    .filter(Boolean);
  for (const f of tracked) {
    if (f.startsWith(".internal/")) fail(`tracked file under .internal/: ${f}`);
    if (/(^|\/)\.env$/.test(f)) fail(`tracked .env file: ${f}`);
  }
} catch {
  console.warn("warn: git not available, skipped the tracked-files check");
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const nbCount = moduleNotebooks.length;
console.log(
  `validate: ok (${WORKSHOPS.length} workshop(s), ${Object.keys(MODULES).length} module(s), ${nbCount} notebook(s))`,
);

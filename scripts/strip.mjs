#!/usr/bin/env node
// Strip outputs and execution counts from every module notebook before committing.
//   node scripts/strip.mjs           rewrite notebooks in place
//   node scripts/strip.mjs --check   exit 1 if any notebook would change
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

function notebooks(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory())
      return d.name === "build" || d.name === "node_modules" || d.name.startsWith(".")
        ? []
        : notebooks(p);
    return d.name.endsWith(".ipynb") ? [p] : [];
  });
}

function strip(nb) {
  for (const cell of nb.cells ?? []) {
    if (cell.cell_type === "code") {
      cell.outputs = [];
      cell.execution_count = null;
    }
    if (cell.metadata) {
      delete cell.metadata.execution;
      delete cell.metadata.collapsed;
      delete cell.metadata.scrolled;
    }
  }
  if (nb.metadata) delete nb.metadata.widgets;
  return JSON.stringify(nb, null, 1) + "\n";
}

let dirty = 0;
for (const file of notebooks(join(root, "modules"))) {
  const before = readFileSync(file, "utf8");
  const after = strip(JSON.parse(before));
  if (before.replace(/\r\n/g, "\n") === after) continue;
  dirty++;
  const name = relative(root, file).split("\\").join("/");
  if (check) {
    console.error(`needs strip: ${name}`);
  } else {
    writeFileSync(file, after);
    console.log(`stripped: ${name}`);
  }
}

if (check && dirty) {
  console.error(
    `\n${dirty} notebook(s) have outputs or execution counts. Run: node scripts/strip.mjs`,
  );
  process.exit(1);
}
if (!dirty) console.log("strip: all notebooks clean");

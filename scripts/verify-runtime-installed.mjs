#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projects = ["workshops/coding-agent/solution", "workshops/coding-agent/exercise"];

let failed = 0;

for (const project of projects) {
  const versionFile = resolve(project, "runtime/.rocketride/.version");
  try {
    const version = (await readFile(versionFile, "utf8")).trim();
    if (!version) throw new Error("empty .version file");
    console.log(`ok: ${project} → runtime v${version}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${project} → ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} project(s) missing runtime install.`);
  process.exit(1);
}
console.log("\nAll runtime installs verified.");

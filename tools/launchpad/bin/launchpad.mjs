#!/usr/bin/env node
import { install } from "../src/install.mjs";
import { start } from "../src/start.mjs";

const [, , subcommand, ...rest] = process.argv;

const commands = {
  install: () => install({ force: false }),
  update: () => install({ force: true }),
  start: () => start(rest),
};

const run = commands[subcommand];

if (!run) {
  console.error(
    `Usage: launchpad <install|update|start>\n\n` +
      `  install   Download and extract the Rocketride runtime into ./runtime/.rocketride.\n` +
      `  update    Same as install, but forces a re-download even if the version matches.\n` +
      `  start     Launch the runtime engine binary from ./runtime/.rocketride.\n`,
  );
  process.exit(subcommand ? 1 : 0);
}

try {
  await run();
} catch (err) {
  console.error(`launchpad ${subcommand} failed:`, err.message ?? err);
  process.exit(1);
}

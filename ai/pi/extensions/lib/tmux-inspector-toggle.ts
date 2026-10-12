/**
 * Entry point for the tmux toggle key: `node tmux-inspector-toggle.ts <binding>`.
 * Reports through tmux's message line since run-shell -b output is discarded.
 */

import { execFileSync } from "node:child_process";
import { toggleDashboard } from "./tmux-inspector.ts";

function notify(message: string): void {
  try {
    execFileSync(process.env.TMUX_BIN ?? "tmux", ["display-message", message], {
      stdio: "ignore",
      timeout: 5_000,
    });
  } catch {
    process.stderr.write(`${message}\n`);
  }
}

const file = process.argv[2];
if (!file) {
  notify("pi inspector toggle: missing binding path");
  process.exitCode = 1;
} else {
  try {
    await toggleDashboard(file);
  } catch (cause) {
    notify(
      `pi inspector toggle: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    process.exitCode = 1;
  }
}

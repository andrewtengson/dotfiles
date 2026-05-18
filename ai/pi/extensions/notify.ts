/**
 * Terminal signals when Pi is working / done.
 *
 * - OSC 9;4;1;100 on agent_start → static progress indicator (full bar)
 * - OSC 9;4;0 on agent_end → clear progress
 * - OSC 133;D;0 on agent_end → command finished (Ghostty tab notification)
 * - BEL on agent_end → terminal bell
 *
 * Uses writeSync(1) to bypass Pi's output guard which intercepts
 * process.stdout.write. Wraps in tmux DCS passthrough when in tmux.
 */

import { writeSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ESC = "\x1b";
const BEL = "\x07";
const ST = `${ESC}\\`;

function inTmux(): boolean {
  return Boolean(process.env.TMUX);
}

function wrapForTmux(sequence: string): string {
  if (!inTmux()) return sequence;
  const escaped = sequence.split(ESC).join(ESC + ESC);
  return `${ESC}Ptmux;${escaped}${ST}`;
}

function buildOSC(payload: string): string {
  const terminator = inTmux() ? ST : BEL;
  return `${ESC}]${payload}${terminator}`;
}

function emit(sequence: string): void {
  const output = inTmux() ? wrapForTmux(sequence) : sequence;
  try {
    writeSync(1, output);
  } catch {
    try {
      writeSync(2, output);
    } catch {}
  }
}

export default function (pi: ExtensionAPI) {
  let active = false;
  let keepalive: ReturnType<typeof setInterval> | undefined;

  function startProgress(): void {
    emit(buildOSC("9;4;1;100"));
    // Ghostty auto-clears progress after ~15s; re-emit every 10s to keep it alive.
    keepalive = setInterval(() => emit(buildOSC("9;4;1;100")), 10_000);
  }

  function stopProgress(): void {
    if (keepalive) {
      clearInterval(keepalive);
      keepalive = undefined;
    }
    emit(buildOSC("9;4;0"));
  }

  pi.on("agent_start", async () => {
    if (active) return;
    active = true;
    startProgress();
  });

  pi.on("agent_end", async () => {
    if (!active) return;
    active = false;
    stopProgress();
    emit(buildOSC("133;D;0"));
    // Write BEL without tmux passthrough so tmux's bell-action can gate it.
    try {
      writeSync(1, BEL);
    } catch {}
  });

  pi.on("session_shutdown", async () => {
    if (!active) return;
    active = false;
    stopProgress();
  });
}

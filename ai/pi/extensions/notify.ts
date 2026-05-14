/**
 * Terminal signals when Pi is working / done.
 *
 * - OSC 9;4;3 on agent_start → indeterminate progress (tab spinner)
 * - OSC 9;4;0 on agent_end → clear progress
 * - OSC 133;D;0 on agent_end → command finished (Ghostty tab notification)
 * - BEL on agent_end → terminal bell
 *
 * Uses writeSync(1) to bypass Pi's output guard which intercepts
 * process.stdout.write. Wraps in tmux DCS passthrough when in tmux.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { writeSync } from "node:fs";

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

  pi.on("agent_start", async () => {
    if (active) return;
    active = true;
    emit(buildOSC("9;4;3"));
  });

  pi.on("agent_end", async () => {
    if (!active) return;
    active = false;
    emit(buildOSC("9;4;0"));
    emit(buildOSC("133;D;0"));
    // Write BEL without tmux passthrough so tmux's bell-action can gate it.
    try { writeSync(1, BEL); } catch {}
  });

  pi.on("session_shutdown", async () => {
    if (!active) return;
    active = false;
    emit(buildOSC("9;4;0"));
  });
}

/**
 * Registers a tmux inspector provider with pi-subagents so Fleet's Enter/H
 * opens the subagent inspector in a tmux split when Pi runs inside tmux.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createTmuxInspectorPlugin } from "./lib/tmux-inspector.js";

const INSPECTOR_REGISTER_EVENT = "pi-subagents:inspector-register:v1";

interface InspectorRegistration {
  dispose(): void;
}

interface InspectorRegistrationRequest {
  version: 1;
  plugin: ReturnType<typeof createTmuxInspectorPlugin>;
  result?:
    | { ok: true; registration: InspectorRegistration }
    | { ok: false; error: Error };
}

export default function (pi: ExtensionAPI) {
  let registration: InspectorRegistration | undefined;

  pi.on("session_start", (_event, ctx) => {
    registration?.dispose();
    registration = undefined;
    if (!process.env.TMUX) return;

    const request: InspectorRegistrationRequest = {
      version: 1,
      plugin: createTmuxInspectorPlugin(),
    };
    pi.events.emit(INSPECTOR_REGISTER_EVENT, request);
    if (!request.result) {
      ctx.ui.notify(
        "tmux inspector: pi-subagents inspector registration unavailable",
        "warning",
      );
      return;
    }
    if (!request.result.ok) {
      ctx.ui.notify(
        `tmux inspector: registration failed: ${request.result.error.message}`,
        "error",
      );
      return;
    }
    registration = request.result.registration;
  });

  pi.on("session_shutdown", () => {
    registration?.dispose();
    registration = undefined;
  });
}

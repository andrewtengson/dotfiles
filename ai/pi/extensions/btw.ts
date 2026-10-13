/**
 * /btw: a side pi session with full tools that starts from the main conversation and never writes
 * back to it. Works while the main agent is streaming.
 *
 * The side session loads the same extensions, skills, AGENTS.md, codemode, tool search, and MCP as
 * a normal session, except process-scoped extensions (see lib/btw/context.ts), and renders in a
 * floating window with pi's own chat components. With a virtual model selected (e.g. kiro/router),
 * it uses the physical model and thinking level that produced the main session's latest response.
 *
 *   /btw <question>   ask, opening the window
 *   /btw              reopen the side thread
 *   /btw:new          dispose the side session; the next question starts fresh
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import {
  existingSideSession,
  getSideSession,
  resetAllSideSessions,
  resetSideSession,
  type SideSession,
  sessionKey,
} from "./lib/btw/btw.js";
import {
  BTW_OVERLAY_OPTIONS,
  type BtwDisplaySettings,
  BtwOverlay,
} from "./lib/btw/btw-ui.js";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The display settings interactive mode uses, read from the user's settings. */
function displaySettings(ctx: ExtensionCommandContext): BtwDisplaySettings {
  const settings = SettingsManager.create(ctx.cwd, undefined, {
    projectTrusted: ctx.isProjectTrusted(),
  });
  return {
    outputPad: settings.getOutputPad(),
    hideThinkingBlock: settings.getHideThinkingBlock(),
    showImages: settings.getShowImages(),
    imageWidthCells: settings.getImageWidthCells(),
    codeBlockIndent: settings.getCodeBlockIndent(),
  };
}

async function openBtw(
  question: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  if (!ctx.hasUI) {
    ctx.ui.notify("/btw requires interactive mode", "error");
    return;
  }
  if (!ctx.model) {
    ctx.ui.notify("/btw requires an active model", "error");
    return;
  }

  const key = sessionKey(ctx);
  const display = displaySettings(ctx);
  let detach: (() => void) | undefined;

  await ctx.ui.custom<void>(
    (tui, theme, keybindings, done) => {
      let attached: SideSession | undefined;

      const attach = async (): Promise<SideSession> => {
        if (attached) return attached;
        overlay.setStatus("Starting side session");
        try {
          const side = await getSideSession(ctx);
          attached = side;
          detach = overlay.attach(
            side.session,
            side.seedCount,
            side.modelLabel,
          );
          return side;
        } finally {
          overlay.setStatus(undefined);
        }
      };

      const submit = (text: string): void => {
        void (async () => {
          try {
            const { session } = await attach();
            if (session.isStreaming) {
              await session.prompt(text, { streamingBehavior: "steer" });
            } else {
              await session.prompt(text);
            }
          } catch (error) {
            overlay.showError(errorText(error));
          }
        })();
      };

      const overlay = new BtwOverlay(tui, theme, keybindings, display, {
        onSubmit: submit,
        onAbort: () => {
          void attached?.session.abort();
        },
        onReset: () => {
          detach?.();
          detach = undefined;
          attached = undefined;
          overlay.detach();
          void resetSideSession(key);
        },
        onClose: () => done(),
      });

      // Reopening shows the existing thread; a question starts or continues it.
      void existingSideSession(ctx).then(async (existing) => {
        try {
          if (existing) await attach();
          if (question) submit(question);
        } catch (error) {
          overlay.showError(errorText(error));
        }
      });
      return overlay;
    },
    { overlay: true, overlayOptions: BTW_OVERLAY_OPTIONS },
  );

  detach?.();
}

export default function btwExtension(pi: ExtensionAPI): void {
  pi.registerCommand("btw", {
    description:
      "Side pi session with full tools; nothing reaches the main conversation",
    handler: (args: string, ctx: ExtensionCommandContext) =>
      openBtw(args.trim(), ctx),
  });

  pi.registerCommand("btw:new", {
    description:
      "Discard the /btw side session; the next question starts fresh",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await resetSideSession(sessionKey(ctx));
      ctx.ui.notify("Started a fresh /btw side session.", "info");
    },
  });

  // A model change or branch navigation makes the side session's seed stale.
  pi.on("model_select", async (_event, ctx) =>
    resetSideSession(sessionKey(ctx)),
  );
  pi.on("session_tree", async (_event, ctx) =>
    resetSideSession(sessionKey(ctx)),
  );
  pi.on("session_shutdown", async () => resetAllSideSessions());
}

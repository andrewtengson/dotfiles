/**
 * Keybind that opens a thinking-level picker (the built-in /thinking selector
 * has no keybinding action). Selection applies to the current session only,
 * matching /thinking.
 */

import { getSupportedThinkingLevels } from "@earendil-works/pi-ai/models";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SHORTCUT = "ctrl+n";

export default function(pi: ExtensionAPI) {
  pi.registerShortcut(SHORTCUT, {
    description: "Select thinking level",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      if (!ctx.model) {
        ctx.ui.notify("No model selected", "warning");
        return;
      }

      const current = pi.getThinkingLevel();
      const levels = getSupportedThinkingLevels(ctx.model);
      const options = levels.map((level) =>
        level === current ? `${level} (current)` : level,
      );

      const choice = await ctx.ui.select("Thinking level", options);
      if (choice === undefined) return;

      const selected = levels[options.indexOf(choice)];
      if (selected === undefined) {
        ctx.ui.notify(`Unknown thinking level: ${choice}`, "error");
        return;
      }
      pi.setThinkingLevel(selected);
      ctx.ui.notify(`Thinking level: ${selected}`, "info");
    },
  });
}

/**
 * Clipboard tool — lets the LLM copy text to the system clipboard via OSC52.
 * Works across SSH, tmux, and modern terminals (iTerm2, Kitty, Alacritty, WezTerm).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

function copyToClipboard(text: string): void {
  const b64 = Buffer.from(text, "utf-8").toString("base64");
  process.stdout.write(`\x1b]52;c;${b64}\x07`);
}

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    name: "copy",
    label: "Copy",
    description:
      "Copy text to the user's system clipboard. Use when the user asks to " +
      "put something in their clipboard or copy generated text for pasting.",
    parameters: Type.Object({
      text: Type.String({ description: "The text to copy to the clipboard" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { text } = params as { text: string };
      if (!text?.trim()) {
        return {
          content: [{ type: "text", text: "Error: No text provided." }],
          details: { success: false },
        };
      }

      copyToClipboard(text);
      const chars = text.length;
      if (ctx.hasUI) {
        ctx.ui.notify(`Copied ${chars} chars to clipboard`, "info");
      }

      return {
        content: [
          {
            type: "text",
            text: `Copied ${chars} characters to clipboard.`,
          },
        ],
        details: { success: true, characterCount: chars },
      };
    },
  });
}

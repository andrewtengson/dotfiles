/**
 * Strip tool-related content from a message array so it can be sent to
 * a tool-less model on Bedrock without triggering the "toolConfig must be
 * defined when using toolUse and toolResult content blocks" validation error.
 *
 * Strategy:
 *   - Drop ToolResultMessage entries entirely.
 *   - Drop ToolCall content blocks from AssistantMessage.content.
 *   - If an AssistantMessage has no remaining content after stripping, drop it.
 *   - UserMessage is passed through unchanged.
 */

import type {
  AssistantMessage,
  Message,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";

export function stripToolMessages(messages: Message[]): Message[] {
  const result: Message[] = [];

  for (const msg of messages) {
    if (msg.role === "toolResult") continue;

    if (msg.role === "assistant") {
      const filtered = msg.content.filter((c) => c.type !== "toolCall");
      if (filtered.length === 0) continue;
      result.push({ ...msg, content: filtered } as AssistantMessage);
      continue;
    }

    result.push(msg);
  }

  return result;
}

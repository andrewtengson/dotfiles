import { describe, expect, test } from "bun:test";
import type {
  AssistantMessage,
  Message,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";
import {
  isExcludedExtension,
  resolveBtwTarget,
  seedMessages,
} from "../extensions/lib/btw/context.js";

function user(text: string): UserMessage {
  return { role: "user", content: text, timestamp: 1 };
}

function assistant(
  content: AssistantMessage["content"],
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    role: "assistant",
    content,
    api: "anthropic-messages",
    provider: "kiro",
    model: "claude-sonnet-5",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 2,
    ...overrides,
  } as AssistantMessage;
}

function toolResult(
  id: string,
  text: string,
  isError = false,
): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: id,
    toolName: "read",
    content: [{ type: "text", text }],
    isError,
    timestamp: 3,
  } as ToolResultMessage;
}

const call = (
  id: string,
  name = "read",
  args: Record<string, unknown> = { path: "a.ts" },
) => ({ type: "toolCall", id, name, arguments: args }) as const;

describe("seedMessages", () => {
  test("drops system messages; the side session builds its own prompt and tools", () => {
    const system = {
      role: "system",
      content: "main",
      timestamp: 0,
    } as unknown as Message;
    expect(seedMessages([system, user("hi")]).map((m) => m.role)).toEqual([
      "user",
    ]);
  });

  test("keeps completed tool calls and their results", () => {
    const out = seedMessages([
      user("read"),
      assistant([call("t1")], { stopReason: "toolUse" }),
      toolResult("t1", "body"),
      assistant([{ type: "text", text: "done" }]),
    ]);
    expect(out.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "toolResult",
      "assistant",
    ]);
  });

  test("drops a tool call still running in the main session, and its orphan result", () => {
    const out = seedMessages([
      user("read"),
      assistant([{ type: "text", text: "reading" }, call("t1"), call("t2")], {
        stopReason: "toolUse",
      }),
      toolResult("t1", "body"),
    ]);
    const asst = out[1] as AssistantMessage;
    expect(
      asst.content.map((b) => (b.type === "toolCall" ? b.id : b.type)),
    ).toEqual(["text", "t1"]);
    expect(out.filter((m) => m.role === "toolResult")).toHaveLength(1);
  });

  test("drops failed responses and assistants left empty", () => {
    const out = seedMessages([
      user("a"),
      assistant([{ type: "text", text: "partial" }], { stopReason: "error" }),
      assistant([call("t9")], { stopReason: "toolUse" }),
    ]);
    expect(out.map((m) => m.role)).toEqual(["user"]);
  });
});

describe("resolveBtwTarget", () => {
  const sonnet = {
    provider: "kiro",
    id: "claude-sonnet-5",
    api: "anthropic-messages",
  };
  const router = { provider: "kiro", id: "router", api: "pi-virtual" };
  const find = (provider: string, id: string) =>
    provider === "kiro" && id === "claude-sonnet-5" ? sonnet : undefined;

  test("uses a physical selection as-is", () => {
    expect(resolveBtwTarget(sonnet, "high", [], find)).toEqual({
      model: sonnet,
      thinkingLevel: "high",
    });
  });

  test("resolves a virtual selection to the model that answered last", () => {
    const msgs = [
      user("a"),
      assistant([{ type: "text", text: "x" }], { thinkingLevel: "low" }),
      assistant([{ type: "text", text: "y" }], {
        stopReason: "error",
        model: "other",
      }),
    ];
    expect(resolveBtwTarget(router, "medium", msgs, find)).toEqual({
      model: sonnet,
      thinkingLevel: "low",
    });
  });

  test("keeps the virtual model before any response so the side session routes it", () => {
    expect(resolveBtwTarget(router, "medium", [user("a")], find)).toEqual({
      model: router,
      thinkingLevel: "medium",
    });
  });
});

describe("isExcludedExtension", () => {
  test("excludes process-scoped extensions and btw itself", () => {
    for (const p of [
      "/Users/me/.pi/agent/extensions/btw.ts",
      "/Users/me/dotfiles/ai/pi/extensions/toggleterm.ts",
      "/Users/me/dotfiles/ai/pi/extensions/notify.ts",
      "/Users/me/dotfiles/ai/pi/extensions/subagent-models.ts",
      "/Users/me/.pi/agent/npm/node_modules/pi-intercom/index.ts",
    ]) {
      expect(isExcludedExtension(p)).toBe(true);
    }
  });

  test("keeps everything else", () => {
    for (const p of [
      "/Users/me/.pi/agent/extensions/tier-router.ts",
      "/Users/me/.pi/agent/npm/node_modules/pi-subagents/src/extension/index.ts",
      "builtin:codemode",
    ]) {
      expect(isExcludedExtension(p)).toBe(false);
    }
  });
});

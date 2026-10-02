import { describe, expect, test } from "bun:test";
import type { Message } from "@earendil-works/pi-ai";
import {
  buildClassifierState,
  decideTier,
  initialTierFromBranch,
  readTierAnswer,
  tierForModel,
} from "../extensions/lib/tier-router.js";
import { TIER_MAP } from "../extensions/lib/model-tiers.js";

function user(text: string): Message {
  return { role: "user", content: text, timestamp: 0 };
}

function assistant(text: string): Message {
  return {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "internal" },
      { type: "text", text },
    ],
    api: "anthropic-messages",
    provider: "kiro",
    model: "claude-opus-5-5",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 0,
  } as Message;
}

describe("decideTier", () => {
  test("picks the most likely tier when there is no current tier", () => {
    expect(decideTier(undefined, { heavy: 0.2, default: 0.5, light: 0.3 })).toBe(
      "default",
    );
  });

  test("moves up when the higher tier is fairly confident", () => {
    expect(decideTier("default", { heavy: 0.72, default: 0.2, light: 0.08 })).toBe(
      "heavy",
    );
  });

  test("stays when an upgrade is not confident enough", () => {
    expect(decideTier("default", { heavy: 0.6, default: 0.3, light: 0.1 })).toBe(
      "default",
    );
  });

  test("moves down only when the lower tier is very confident", () => {
    expect(decideTier("heavy", { heavy: 0.05, default: 0.9, light: 0.05 })).toBe(
      "default",
    );
    expect(decideTier("heavy", { heavy: 0.1, default: 0.8, light: 0.1 })).toBe(
      "heavy",
    );
  });

  test("ignores unknown or missing probabilities", () => {
    expect(decideTier("default", { other: 0.99 })).toBe("default");
    expect(decideTier(undefined, {})).toBe("default");
  });
});

describe("readTierAnswer", () => {
  test("returns probabilities from a choice answer", () => {
    const probs = { heavy: 0.1, default: 0.8, light: 0.1 };
    expect(
      readTierAnswer({
        stopReason: "stop",
        answers: {
          tier: { type: "choice", choice: "default", probabilities: probs, confidence: 0.7 },
        },
      }),
    ).toEqual(probs);
  });

  test("returns undefined for errors or unexpected answers", () => {
    expect(readTierAnswer({ stopReason: "error", answers: {} })).toBeUndefined();
    expect(
      readTierAnswer({
        stopReason: "stop",
        answers: { tier: { type: "bool", probability: 0.9 } },
      }),
    ).toBeUndefined();
  });
});

describe("buildClassifierState", () => {
  test("includes the prompt, recent user messages, and last assistant text only", () => {
    const messages: Message[] = [
      { role: "system", content: "system prompt" } as unknown as Message,
      user("first"),
      assistant("a1"),
      user("second"),
      assistant("a2"),
      user("third"),
      assistant("here is the plan"),
      user("do it"),
    ];
    const state = buildClassifierState(messages, "heavy");
    expect(state).toEqual({
      current_tier: "heavy",
      recent_user_messages: ["second", "third"],
      last_assistant_reply: "here is the plan",
      prompt: "do it",
    });
  });

  test("truncates long content and handles a fresh conversation", () => {
    const state = buildClassifierState([user("x".repeat(20_000))], undefined);
    expect(state.current_tier).toBe("none");
    expect(state.recent_user_messages).toEqual([]);
    expect(state.last_assistant_reply).toBe("");
    expect(String(state.prompt).length).toBe(8_000);
  });
});

describe("tierForModel", () => {
  test("maps a physical model and thinking level back to its tier", () => {
    const tiers = TIER_MAP.kiro;
    expect(tierForModel(tiers, "claude-opus-5-5", "high")).toBe("heavy");
    expect(tierForModel(tiers, "claude-sonnet-5", "low")).toBe("light");
    expect(tierForModel(tiers, "claude-sonnet-5", "medium")).toBe("default");
    expect(tierForModel(tiers, "claude-sonnet-5", undefined)).toBe("default");
    expect(tierForModel(tiers, "something-else", "high")).toBeUndefined();
  });
});

describe("initialTierFromBranch", () => {
  const tiers = TIER_MAP.kiro;
  const STATE = "pi.virtual-model-state";
  const stateEntry = (provider: string, tier: string) => ({
    type: "custom",
    customType: STATE,
    data: { provider, modelId: "router", state: { tier } },
  });
  const reply = (
    provider: string,
    model: string,
    thinkingLevel: string,
    stopReason = "stop",
  ) => ({
    type: "message",
    message: { role: "assistant", provider, model, thinkingLevel, stopReason },
  });

  test("prefers the latest stored router state for this provider", () => {
    const branch = [
      stateEntry("kiro", "light"),
      stateEntry("kiro", "heavy"),
      stateEntry("xai", "light"),
      reply("kiro", "claude-sonnet-5", "low"),
    ];
    expect(initialTierFromBranch(branch, "kiro", "router", STATE, tiers)).toBe(
      "heavy",
    );
  });

  test("falls back to the last successful reply from this provider", () => {
    const branch = [
      reply("kiro", "claude-opus-5-5", "high"),
      reply("kiro", "claude-sonnet-5", "low", "error"),
      reply("xai", "grok-4.7", "low"),
    ];
    expect(initialTierFromBranch(branch, "kiro", "router", STATE, tiers)).toBe(
      "heavy",
    );
  });

  test("defaults when nothing on the branch identifies a tier", () => {
    expect(initialTierFromBranch([], "kiro", "router", STATE, tiers)).toBe(
      "default",
    );
    expect(
      initialTierFromBranch(
        [reply("kiro", "claude-haiku-4-5", "off")],
        "kiro",
        "router",
        STATE,
        tiers,
      ),
    ).toBe("default");
  });
});

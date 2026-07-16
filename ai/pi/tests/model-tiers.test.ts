import { describe, expect, test } from "bun:test";
import { resolveTierMap } from "../extensions/lib/model-tiers.js";

describe("resolveTierMap", () => {
  test("uses Kiro registry IDs for GPT models", () => {
    expect(resolveTierMap("kiro", "gpt-5-6-terra")).toEqual({
      heavy: { modelId: "gpt-5-6-sol", thinkingLevel: "high" },
      default: { modelId: "gpt-5-6-sol", thinkingLevel: "medium" },
      light: { modelId: "gpt-5-6-luna", thinkingLevel: "high" },
      fast: { modelId: "gpt-5-6-luna", thinkingLevel: "low" },
    });
  });

  test("keeps Anthropic tiers for Kiro Claude models", () => {
    expect(resolveTierMap("kiro", "claude-sonnet-5")).toEqual({
      heavy: { modelId: "claude-opus-4-8", thinkingLevel: "high" },
      default: { modelId: "claude-sonnet-5", thinkingLevel: "medium" },
      light: { modelId: "claude-sonnet-5", thinkingLevel: "low" },
      fast: { modelId: "claude-haiku-4-5", thinkingLevel: "off" },
    });
  });

  test("defaults unknown Kiro model families to Anthropic tiers", () => {
    expect(resolveTierMap("kiro", "deepseek-r1").heavy.modelId).toBe(
      "claude-opus-4-8",
    );
  });

  test("keeps dotted model IDs for OpenAI providers", () => {
    expect(resolveTierMap("openai-codex", "gpt-5.6-terra")).toEqual({
      heavy: { modelId: "gpt-5.6-sol", thinkingLevel: "high" },
      default: { modelId: "gpt-5.6-sol", thinkingLevel: "medium" },
      light: { modelId: "gpt-5.6-luna", thinkingLevel: "high" },
      fast: { modelId: "gpt-5.6-luna", thinkingLevel: "low" },
    });
  });
});

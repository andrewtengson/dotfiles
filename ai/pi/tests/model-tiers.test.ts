import { describe, expect, test } from "bun:test";
import {
  type ProviderKey,
  resolveTierMap,
  TIER_MAP,
  type Tier,
  type TierMap,
} from "../extensions/lib/model-tiers.js";

const TIERS: Tier[] = ["heavy", "default", "light", "fast"];

function modelIds(map: TierMap): string[] {
  return TIERS.map((tier) => map[tier].modelId);
}

describe("resolveTierMap", () => {
  test("resolves every configured provider from the tier map", () => {
    for (const provider of Object.keys(TIER_MAP) as ProviderKey[]) {
      const map = resolveTierMap(provider);
      expect(map, provider).toBe(TIER_MAP[provider]);
      expect(
        modelIds(map).every((id) => id.length > 0),
        provider,
      ).toBe(true);
    }
  });

  test("routes Kiro GPT sessions to dashed registry ids", () => {
    const map = resolveTierMap("kiro", "gpt-current");
    expect(map).not.toBe(TIER_MAP.kiro);
    for (const id of modelIds(map)) {
      expect(id.startsWith("gpt-")).toBe(true);
      expect(id.includes(".")).toBe(false);
    }
  });

  test("keeps non-GPT Kiro sessions on the default Anthropic map", () => {
    expect(resolveTierMap("kiro", "claude-sonnet")).toBe(TIER_MAP.kiro);
    expect(resolveTierMap("kiro", "deepseek")).toBe(TIER_MAP.kiro);
    expect(resolveTierMap("kiro")).toBe(TIER_MAP.kiro);
    for (const id of modelIds(TIER_MAP.kiro)) {
      expect(id.startsWith("claude-")).toBe(true);
      expect(id.startsWith("global.anthropic.")).toBe(false);
    }
  });

  test("shares OpenAI ids across OpenAI-shaped providers", () => {
    const codex = resolveTierMap("openai-codex");
    expect(codex).toBe(resolveTierMap("azure-openai-responses"));
    for (const id of modelIds(codex)) {
      expect(id.startsWith("gpt-")).toBe(true);
    }
  });

  test("prefixes Bedrock ids with the global inference profile", () => {
    const bedrock = modelIds(resolveTierMap("amazon-bedrock"));
    const kiro = modelIds(resolveTierMap("kiro"));
    expect(bedrock).toEqual(kiro.map((id) => `global.anthropic.${id}`));
  });

  test("uses one xAI model and only varies thinking level", () => {
    const map = resolveTierMap("xai");
    const ids = new Set(modelIds(map));
    expect(ids.size).toBe(1);
    expect([...ids][0]?.startsWith("grok-")).toBe(true);
    expect(map.heavy.thinkingLevel).toBe("high");
    expect(map.default.thinkingLevel).toBe("medium");
    expect(map.light.thinkingLevel).toBe("low");
    expect(map.fast.thinkingLevel).toBe("low");
  });
});

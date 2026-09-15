import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  longContextInputLimit,
  shouldCompactBeforeLongContext,
} from "../extensions/pricing-compaction";

function loadSettings(): { reserveTokens: number } {
  const settings = JSON.parse(
    readFileSync(join(homedir(), ".pi/agent/settings.json"), "utf8"),
  ) as { compaction?: { reserveTokens?: number } };
  return { reserveTokens: settings.compaction?.reserveTokens ?? 32768 };
}

type ModelStore = {
  providers?: {
    xai?: {
      modelOverrides?: {
        "grok-4.6"?: { cost?: { tiers?: { inputTokensAbove: number }[] } };
      };
    };
    kiro?: {
      modelOverrides?: Record<
        string,
        { cost?: { tiers?: { inputTokensAbove: number }[] } }
      >;
    };
  };
};

function loadModelStore(): ModelStore {
  return JSON.parse(
    readFileSync(join(import.meta.dir, "../models.json"), "utf8"),
  ) as ModelStore;
}

function loadGrokTiers(): { inputTokensAbove: number }[] | undefined {
  return loadModelStore().providers?.xai?.modelOverrides?.["grok-4.6"]?.cost
    ?.tiers;
}

function loadKiroGpt56Tiers(
  id: "gpt-5-6-sol" | "gpt-5-6-terra" | "gpt-5-6-luna",
): { inputTokensAbove: number }[] | undefined {
  return loadModelStore().providers?.kiro?.modelOverrides?.[id]?.cost?.tiers;
}

describe("pricing auto-compaction simulation", () => {
  test("tracked grok-4.6 config compacts before the 200k pricing tier", () => {
    const { reserveTokens } = loadSettings();
    const tiers = loadGrokTiers();
    const limit = longContextInputLimit({ tiers });
    const cutoff = (limit ?? Number.NaN) - reserveTokens;
    const builtInCutoff = 500000 - reserveTokens;

    expect(tiers?.[0]?.inputTokensAbove).toBe(200000);
    expect(reserveTokens).toBe(32768);
    expect(cutoff).toBe(167232);
    expect(cutoff).toBeLessThan(200000);
    expect(builtInCutoff).toBe(467232);
    expect(
      shouldCompactBeforeLongContext({
        tokens: 167232,
        longContextLimit: limit,
        reserveTokens,
      }),
    ).toBe(false);
    expect(
      shouldCompactBeforeLongContext({
        tokens: 167233,
        longContextLimit: limit,
        reserveTokens,
      }),
    ).toBe(true);
  });

  test("tracked kiro gpt-5.6 config compacts before the 272k pricing tier", () => {
    const { reserveTokens } = loadSettings();
    const ids = ["gpt-5-6-sol", "gpt-5-6-terra", "gpt-5-6-luna"] as const;
    const builtInCutoff = 1000000 - reserveTokens;

    expect(reserveTokens).toBe(32768);
    expect(builtInCutoff).toBe(967232);

    for (const id of ids) {
      const tiers = loadKiroGpt56Tiers(id);
      const limit = longContextInputLimit({ tiers });
      const cutoff = (limit ?? Number.NaN) - reserveTokens;

      expect(tiers?.[0]?.inputTokensAbove).toBe(272000);
      expect(cutoff).toBe(239232);
      expect(cutoff).toBeLessThan(272000);
      expect(
        shouldCompactBeforeLongContext({
          tokens: 239232,
          longContextLimit: limit,
          reserveTokens,
        }),
      ).toBe(false);
      expect(
        shouldCompactBeforeLongContext({
          tokens: 239233,
          longContextLimit: limit,
          reserveTokens,
        }),
      ).toBe(true);
    }
  });
});

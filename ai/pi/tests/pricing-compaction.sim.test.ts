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

function loadGrokTiers(): { inputTokensAbove: number }[] | undefined {
  const store = JSON.parse(
    readFileSync(join(homedir(), ".pi/agent/models.json"), "utf8"),
  ) as {
    providers?: {
      xai?: {
        modelOverrides?: {
          "grok-4.6"?: { cost?: { tiers?: { inputTokensAbove: number }[] } };
        };
      };
    };
  };
  return store.providers?.xai?.modelOverrides?.["grok-4.6"]?.cost?.tiers;
}

describe("pricing auto-compaction simulation", () => {
  test("live grok-4.6 config compacts before the 200k pricing tier", () => {
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
});

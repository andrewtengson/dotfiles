import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildHandoffCompactionPrompt,
  longContextInputLimit,
  pricingCompactionAction,
} from "../extensions/lib/handoff-compaction";

const GROK_COST = {
  tiers: [{ inputTokensAbove: 200000 }],
};

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

function readHandoffSkill(): string {
  const raw = readFileSync(
    join(homedir(), ".agents/skills/handoff/SKILL.md"),
    "utf8",
  );
  const end = raw.startsWith("---") ? raw.indexOf("\n---", 3) : -1;
  return (end < 0 ? raw : raw.slice(end + 4)).trim();
}

describe("handoff auto-compaction simulation", () => {
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
  });

  test("simulates skip / compact / continue against grok-4.6", () => {
    const { reserveTokens } = loadSettings();
    const base = {
      compacting: false,
      cost: GROK_COST,
      reserveTokens,
    };

    expect(
      pricingCompactionAction({
        ...base,
        tokens: 167232,
        hasToolResults: true,
      }),
    ).toBe("skip");

    expect(
      pricingCompactionAction({
        ...base,
        tokens: 167233,
        hasToolResults: true,
      }),
    ).toBe("compact-and-continue");

    expect(
      pricingCompactionAction({
        ...base,
        tokens: 180000,
        hasToolResults: false,
      }),
    ).toBe("compact");

    expect(
      pricingCompactionAction({
        ...base,
        compacting: true,
        tokens: 180000,
        hasToolResults: true,
      }),
    ).toBe("skip");
  });

  test("builds a continuation handoff prompt from the real skill", () => {
    const skill = readHandoffSkill();
    const prompt = buildHandoffCompactionPrompt({
      skillInstructions: skill,
      conversationText: "[User]: implement compaction\n[Assistant]: working",
    });

    expect(skill).toContain("Write a handoff document");
    expect(prompt).toContain("suggested skills");
    expect(prompt).toContain("Continue from this handoff");
    expect(prompt).toContain("implement compaction");
    expect(prompt).toContain("Do not write a file");
  });
});

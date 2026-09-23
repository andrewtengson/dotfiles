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

type ModelOverride = {
  cost?: { tiers?: { inputTokensAbove: number }[] };
};

type ModelStore = {
  providers?: Record<
    string,
    { modelOverrides?: Record<string, ModelOverride> }
  >;
};

function loadOverrides(provider: string): Record<string, ModelOverride> {
  const store = JSON.parse(
    readFileSync(join(import.meta.dir, "../models.json"), "utf8"),
  ) as ModelStore;
  return store.providers?.[provider]?.modelOverrides ?? {};
}

function expectCompactsBeforeTier(
  id: string,
  override: ModelOverride,
  reserveTokens: number,
): void {
  const limit = longContextInputLimit(override.cost);
  expect(limit, id).toBeGreaterThan(reserveTokens);
  const cutoff = (limit ?? 0) - reserveTokens;
  expect(
    shouldCompactBeforeLongContext({
      tokens: cutoff,
      longContextLimit: limit,
      reserveTokens,
    }),
    id,
  ).toBe(false);
  expect(
    shouldCompactBeforeLongContext({
      tokens: cutoff + 1,
      longContextLimit: limit,
      reserveTokens,
    }),
    id,
  ).toBe(true);
}

describe("pricing auto-compaction simulation", () => {
  test("every tracked xAI override compacts before its pricing tier", () => {
    const { reserveTokens } = loadSettings();
    const overrides = loadOverrides("xai");
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
    expect(reserveTokens).toBeGreaterThan(0);
    for (const [id, override] of Object.entries(overrides)) {
      expectCompactsBeforeTier(id, override, reserveTokens);
    }
  });

  test("every tracked Azure override compacts before its pricing tier", () => {
    const { reserveTokens } = loadSettings();
    const overrides = loadOverrides("azure-openai-responses");
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
    for (const [id, override] of Object.entries(overrides)) {
      expectCompactsBeforeTier(id, override, reserveTokens);
    }
  });

  test("every tracked Kiro override compacts before its pricing tier", () => {
    const { reserveTokens } = loadSettings();
    const overrides = loadOverrides("kiro");
    expect(Object.keys(overrides).length).toBeGreaterThan(0);
    for (const [id, override] of Object.entries(overrides)) {
      expectCompactsBeforeTier(id, override, reserveTokens);
    }
  });
});

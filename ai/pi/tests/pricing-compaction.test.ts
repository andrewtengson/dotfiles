import { describe, expect, test } from "bun:test";
import {
  longContextInputLimit,
  pricingCompactionAction,
  shouldCompactBeforeLongContext,
} from "../extensions/pricing-compaction";

describe("longContextInputLimit", () => {
  test("returns the lowest inputTokensAbove tier", () => {
    expect(
      longContextInputLimit({
        tiers: [{ inputTokensAbove: 400000 }, { inputTokensAbove: 200000 }],
      }),
    ).toBe(200000);
  });

  test("returns undefined without pricing tiers", () => {
    expect(longContextInputLimit(undefined)).toBeUndefined();
    expect(longContextInputLimit({})).toBeUndefined();
    expect(longContextInputLimit({ tiers: [] })).toBeUndefined();
  });
});

describe("shouldCompactBeforeLongContext", () => {
  test("triggers after crossing limit minus reserve", () => {
    expect(
      shouldCompactBeforeLongContext({
        tokens: 167233,
        longContextLimit: 200000,
        reserveTokens: 32768,
      }),
    ).toBe(true);
  });

  test("does not trigger at or below the reserve cutoff", () => {
    expect(
      shouldCompactBeforeLongContext({
        tokens: 167232,
        longContextLimit: 200000,
        reserveTokens: 32768,
      }),
    ).toBe(false);
  });

  test("does not trigger without a long-context limit", () => {
    expect(
      shouldCompactBeforeLongContext({
        tokens: 400000,
        longContextLimit: undefined,
        reserveTokens: 32768,
      }),
    ).toBe(false);
  });

  test("triggers after crossing the 272k kiro gpt-5.6 cliff minus reserve", () => {
    expect(
      shouldCompactBeforeLongContext({
        tokens: 239232,
        longContextLimit: 272000,
        reserveTokens: 32768,
      }),
    ).toBe(false);
    expect(
      shouldCompactBeforeLongContext({
        tokens: 239233,
        longContextLimit: 272000,
        reserveTokens: 32768,
      }),
    ).toBe(true);
  });
});

describe("pricingCompactionAction", () => {
  const base = {
    compacting: false,
    cost: { tiers: [{ inputTokensAbove: 272000 }] },
    reserveTokens: 32768,
  };

  test("continues the in-flight turn after compacting past tool results", () => {
    expect(
      pricingCompactionAction({
        ...base,
        tokens: 239233,
        hasToolResults: true,
      }),
    ).toBe("compact-and-continue");
  });

  test("compacts a finished turn without injecting continue", () => {
    expect(
      pricingCompactionAction({
        ...base,
        tokens: 239233,
        hasToolResults: false,
      }),
    ).toBe("compact");
  });
});

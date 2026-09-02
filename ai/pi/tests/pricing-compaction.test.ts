import { describe, expect, test } from "bun:test";
import {
  longContextInputLimit,
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
});

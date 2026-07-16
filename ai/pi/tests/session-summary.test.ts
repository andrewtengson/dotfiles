import { describe, expect, test } from "bun:test";
import { shouldAutoSummarize } from "../extensions/lib/session-summary-policy";

describe("shouldAutoSummarize", () => {
  test("skips automatic summaries without UI", () => {
    expect(shouldAutoSummarize({ hasUI: false })).toBe(false);
  });

  test("keeps automatic summaries for UI sessions", () => {
    expect(shouldAutoSummarize({ hasUI: true })).toBe(true);
  });
});

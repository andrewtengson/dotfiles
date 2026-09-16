import { describe, expect, test } from "bun:test";
import { renderBar } from "../extensions/lib/usage-bar";

describe("renderBar", () => {
  const theme = { fg: (_color: string, text: string) => text };

  test("renders no filled cells at 0% usage", () => {
    expect(renderBar(0, 12, theme)).toBe("\u2591".repeat(12));
  });
});

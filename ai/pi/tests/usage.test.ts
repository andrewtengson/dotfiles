import { describe, expect, test } from "bun:test";
import { renderBar } from "../extensions/lib/usage-bar";

describe("renderBar", () => {
  test("renders a filled cell at 0% usage", () => {
    const theme = { fg: (_color: string, text: string) => text };

    expect(renderBar(0, 12, theme)).toBe(`\u2588${"\u2591".repeat(11)}`);
  });
});

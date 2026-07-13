import { expect, test } from "bun:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { fitStatusLine } from "./editor.js";

test("status line fits after terminal narrows", () => {
  const left = "high · gpt-5.6-sol · azure-openai-responses";
  const right =
    "~/Documents/projects/maya-gitlab/volume-testing-agent · main · 279.2K (26%) · $10.07";

  const rendered = fitStatusLine(left, right, 127);

  expect(visibleWidth(rendered)).toBe(127);
});

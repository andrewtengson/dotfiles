import { describe, expect, test } from "bun:test";
import { patchProviderReasoningSource } from "../extensions/kiro-model-sync";

describe("patchProviderReasoningSource", () => {
  test("disables Claude-style thinking only for GPT models", () => {
    const original =
      "const thinkingEnabled = !!options?.reasoning || model.reasoning;";

    const patched = patchProviderReasoningSource(original);

    expect(patched.changed).toBe(true);
    expect(patched.source).toBe(
      'const thinkingEnabled = !model.id.startsWith("gpt-") && (!!options?.reasoning || model.reasoning);',
    );
  });
});

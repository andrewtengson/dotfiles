import { describe, expect, test } from "bun:test";
import {
  PROVIDER_MODELS,
  resolveEnabledModels,
} from "../extensions/lib/enabled-models.js";

describe("resolveEnabledModels", () => {
  test("prefixes Bedrock Anthropic models with the global inference profile", () => {
    expect(resolveEnabledModels("amazon-bedrock")).toEqual([
      "amazon-bedrock/global.anthropic.claude-opus-5:medium",
    ]);
  });

  test("keeps dotted OpenAI ids for the OpenAI-shaped providers", () => {
    expect(resolveEnabledModels("openai-codex")).toEqual([
      "openai-codex/gpt-5.6-sol:medium",
      "openai-codex/gpt-5.6-luna:high",
    ]);
    expect(resolveEnabledModels("azure-openai-responses")).toEqual([
      "azure-openai-responses/gpt-5.6-sol:medium",
      "azure-openai-responses/gpt-5.6-luna:high",
    ]);
  });

  test("gives Kiro both families with dashed OpenAI ids", () => {
    expect(resolveEnabledModels("kiro")).toEqual([
      "kiro/claude-opus-5:medium",
      "kiro/gpt-5-6-sol:medium",
      "kiro/gpt-5-6-luna:high",
    ]);
  });

  test("puts the default model first so it wins the startup model scope", () => {
    expect(resolveEnabledModels("kiro", "gpt-5-6-luna")).toEqual([
      "kiro/gpt-5-6-luna:high",
      "kiro/claude-opus-5:medium",
      "kiro/gpt-5-6-sol:medium",
    ]);
  });

  test("ignores a default model the provider does not list", () => {
    expect(resolveEnabledModels("kiro", "claude-sonnet-4-6")).toEqual(
      resolveEnabledModels("kiro"),
    );
  });

  test("covers every provider key with at least one model", () => {
    for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
      expect(models.length, provider).toBeGreaterThan(0);
    }
  });
});

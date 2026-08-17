/**
 * Regularly-used models per provider.
 *
 * Single source of truth for the `enabledModels` setting (the Ctrl+P cycle
 * list). Distinct from model-tiers.ts: tiers describe where the router sends a
 * turn, this describes which models are worth cycling through by hand.
 */

import type { ProviderKey, ThinkingLevel } from "./model-tiers.js";

export interface ModelChoice {
  modelId: string;
  thinkingLevel?: ThinkingLevel;
}

const ANTHROPIC_MODELS: ModelChoice[] = [
  { modelId: "claude-opus-5", thinkingLevel: "medium" },
];

const OPENAI_MODELS: ModelChoice[] = [
  { modelId: "gpt-5.6-sol", thinkingLevel: "medium" },
  { modelId: "gpt-5.6-luna", thinkingLevel: "high" },
];

/** Bedrock exposes Anthropic models behind an inference profile prefix. */
function withModelPrefix(
  choices: ModelChoice[],
  prefix: string,
): ModelChoice[] {
  return choices.map((choice) => ({
    ...choice,
    modelId: `${prefix}${choice.modelId}`,
  }));
}

/** Kiro spells OpenAI model ids with dashes instead of dots. */
function withDashedVersions(choices: ModelChoice[]): ModelChoice[] {
  return choices.map((choice) => ({
    ...choice,
    modelId: choice.modelId.replaceAll(".", "-"),
  }));
}

export const PROVIDER_MODELS: Record<ProviderKey, ModelChoice[]> = {
  "amazon-bedrock": withModelPrefix(ANTHROPIC_MODELS, "global.anthropic."),
  "openai-codex": OPENAI_MODELS,
  "azure-openai-responses": OPENAI_MODELS,
  kiro: [...ANTHROPIC_MODELS, ...withDashedVersions(OPENAI_MODELS)],
};

/**
 * Format one choice as an `enabledModels` entry (`provider/modelId:thinking`).
 * The thinking suffix is omitted when the choice does not pin one.
 */
export function formatModelPattern(
  provider: ProviderKey,
  { modelId, thinkingLevel }: ModelChoice,
): string {
  return thinkingLevel
    ? `${provider}/${modelId}:${thinkingLevel}`
    : `${provider}/${modelId}`;
}

/** Build the full `enabledModels` list for a provider. */
export function resolveEnabledModels(provider: ProviderKey): string[] {
  return PROVIDER_MODELS[provider].map((choice) =>
    formatModelPattern(provider, choice),
  );
}

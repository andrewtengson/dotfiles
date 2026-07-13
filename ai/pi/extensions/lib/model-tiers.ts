/**
 * Shared model tier configuration for model-router and subagent-models.
 *
 * Single source of truth for provider → tier → model mapping.
 */

export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";
export type Tier = "heavy" | "default" | "light" | "fast";
export type ProviderKey =
  | "amazon-bedrock"
  | "openai-codex"
  | "kiro"
  | "azure-openai-responses";

export interface TierTarget {
  modelId: string;
  thinkingLevel: ThinkingLevel;
}

const OPENAI_TIERS = {
  heavy: { modelId: "gpt-5.6-sol", thinkingLevel: "high" },
  default: { modelId: "gpt-5.6-sol", thinkingLevel: "medium" },
  light: { modelId: "gpt-5.6-luna", thinkingLevel: "medium" },
  fast: { modelId: "gpt-5.6-luna", thinkingLevel: "low" },
} satisfies Record<Tier, TierTarget>;

export const TIER_MAP: Record<ProviderKey, Record<Tier, TierTarget>> = {
  "amazon-bedrock": {
    heavy: {
      modelId: "global.anthropic.claude-opus-4-8",
      thinkingLevel: "high",
    },
    default: {
      modelId: "global.anthropic.claude-sonnet-5",
      thinkingLevel: "medium",
    },
    light: {
      modelId: "global.anthropic.claude-sonnet-5",
      thinkingLevel: "low",
    },
    fast: {
      modelId: "global.anthropic.claude-haiku-4-5",
      thinkingLevel: "off",
    },
  },
  "openai-codex": OPENAI_TIERS,
  "azure-openai-responses": OPENAI_TIERS,
  kiro: {
    heavy: { modelId: "claude-opus-4-8", thinkingLevel: "high" },
    default: { modelId: "claude-sonnet-5", thinkingLevel: "medium" },
    light: { modelId: "claude-sonnet-5", thinkingLevel: "low" },
    fast: { modelId: "claude-haiku-4-5", thinkingLevel: "off" },
  },
};

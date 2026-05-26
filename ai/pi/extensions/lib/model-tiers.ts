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
export type ProviderKey = "amazon-bedrock" | "openai-codex" | "kiro";

export interface TierTarget {
  modelId: string;
  thinkingLevel: ThinkingLevel;
}

export const TIER_MAP: Record<ProviderKey, Record<Tier, TierTarget>> = {
  "amazon-bedrock": {
    heavy: {
      modelId: "global.anthropic.claude-opus-4-7",
      thinkingLevel: "high",
    },
    default: {
      modelId: "global.anthropic.claude-sonnet-4-6",
      thinkingLevel: "medium",
    },
    light: {
      modelId: "global.anthropic.claude-sonnet-4-6",
      thinkingLevel: "low",
    },
    fast: {
      modelId: "global.anthropic.claude-haiku-4-5",
      thinkingLevel: "off",
    },
  },
  "openai-codex": {
    heavy: { modelId: "gpt-5.5", thinkingLevel: "high" },
    default: { modelId: "gpt-5.5", thinkingLevel: "medium" },
    light: { modelId: "gpt-5.5", thinkingLevel: "low" },
    fast: { modelId: "gpt-5.4-mini", thinkingLevel: "off" },
  },
  kiro: {
    heavy: { modelId: "claude-opus-4-7", thinkingLevel: "high" },
    default: { modelId: "claude-sonnet-4-6", thinkingLevel: "medium" },
    light: { modelId: "claude-sonnet-4-6", thinkingLevel: "low" },
    fast: { modelId: "claude-haiku-4-5", thinkingLevel: "off" },
  },
};

/**
 * Pure routing logic for the tier router: classifier state, tier decision, and answer parsing.
 * Kept free of pi runtime dependencies so it can be unit tested.
 */

import type { Message } from "@earendil-works/pi-ai";
import type { ThinkingLevel, Tier, TierMap } from "./model-tiers.js";

export type RoutedTier = Exclude<Tier, "fast">;

/** Ordered weakest to strongest. */
export const ROUTED_TIERS: readonly RoutedTier[] = [
  "light",
  "default",
  "heavy",
];

/** Probability the classifier must give a stronger tier before moving up. */
export const UPGRADE_THRESHOLD = 0.7;
/** Probability the classifier must give a weaker tier before moving down. */
export const DOWNGRADE_THRESHOLD = 0.85;

const MAX_PROMPT_CHARS = 8_000;
const MAX_USER_MESSAGE_CHARS = 1_000;
const MAX_ASSISTANT_CHARS = 2_000;
const RECENT_USER_MESSAGES = 2;

export const TIER_QUESTION = {
  type: "choice",
  instructions:
    "Which kind of work does `prompt` request? Use `recent_user_messages` and `last_assistant_reply` only as context for short or follow-up prompts.",
  criteria: {
    heavy: "Complex reasoning, planning, deep thinking",
    default: "Research, implementation, general work",
    light: "Fast retrieval, scouting, context gathering",
  },
} as const;

export interface ClassifierState {
  [key: string]: string | string[];
  current_tier: RoutedTier | "none";
  recent_user_messages: string[];
  last_assistant_reply: string;
  prompt: string;
}

function textOf(message: Message): string {
  if (message.role !== "user" && message.role !== "assistant") return "";
  const content = message.content;
  if (typeof content === "string") return content;
  return content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
}

/** Bounded context for one routing decision: no tool output, thinking, or system prompt. */
export function buildClassifierState(
  messages: readonly Message[],
  currentTier: RoutedTier | undefined,
): ClassifierState {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map(textOf);
  const lastAssistant = messages.findLast(
    (message) => message.role === "assistant",
  );

  return {
    current_tier: currentTier ?? "none",
    recent_user_messages: userTexts
      .slice(-(RECENT_USER_MESSAGES + 1), -1)
      .map((text) => text.slice(0, MAX_USER_MESSAGE_CHARS)),
    last_assistant_reply: lastAssistant
      ? textOf(lastAssistant).slice(0, MAX_ASSISTANT_CHARS)
      : "",
    prompt: (userTexts.at(-1) ?? "").slice(0, MAX_PROMPT_CHARS),
  };
}

interface ClassifierLikeResult {
  stopReason: string;
  answers: Record<string, unknown>;
}

/** Tier probabilities from a classifier result, or undefined when the call did not answer. */
export function readTierAnswer(
  result: ClassifierLikeResult,
): Record<string, number> | undefined {
  if (result.stopReason !== "stop") return undefined;
  const answer = result.answers.tier as
    | { type?: string; probabilities?: Record<string, number> }
    | undefined;
  if (answer?.type !== "choice" || !answer.probabilities) return undefined;
  return answer.probabilities;
}

/**
 * Sticky tier decision. Without a current tier, take the most likely tier. Otherwise move up only
 * when a stronger tier reaches UPGRADE_THRESHOLD, and down only when a weaker tier reaches
 * DOWNGRADE_THRESHOLD; stay put in every other case.
 */
export function decideTier(
  current: RoutedTier | undefined,
  probabilities: Record<string, number>,
): RoutedTier {
  const probability = (tier: RoutedTier): number => probabilities[tier] ?? 0;

  if (!current) {
    const best = ROUTED_TIERS.reduce((a, b) =>
      probability(b) > probability(a) ? b : a,
    );
    return probability(best) > 0 ? best : "default";
  }

  const rank = ROUTED_TIERS.indexOf(current);
  const stronger = ROUTED_TIERS.slice(rank + 1)
    .filter((tier) => probability(tier) >= UPGRADE_THRESHOLD)
    .at(-1);
  if (stronger) return stronger;

  const weaker = ROUTED_TIERS.slice(0, rank).find(
    (tier) => probability(tier) >= DOWNGRADE_THRESHOLD,
  );
  return weaker ?? current;
}

/** Tier whose model and thinking level match, preferring an exact thinking match. */
export function tierForModel(
  tiers: TierMap,
  modelId: string,
  thinkingLevel: ThinkingLevel | string | undefined,
): RoutedTier | undefined {
  const candidates = ROUTED_TIERS.filter(
    (tier) => tiers[tier].modelId === modelId,
  );
  const exact = candidates.find(
    (tier) => tiers[tier].thinkingLevel === thinkingLevel,
  );
  if (exact) return exact;
  if (candidates.includes("default")) return "default";
  return candidates[0];
}

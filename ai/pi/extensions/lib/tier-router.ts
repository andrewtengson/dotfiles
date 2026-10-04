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
    heavy:
      "Complex reasoning, planning, deep thinking, design and architecture tradeoffs, debugging failures that persist after attempts",
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
 * Sticky tier decision. Without a current tier, take the most likely tier. Otherwise move up when
 * the stronger tiers together reach UPGRADE_THRESHOLD (to the most likely of them), and down only
 * when a single weaker tier reaches DOWNGRADE_THRESHOLD. Stay put otherwise. Upgrades pool
 * probability because under-powering a task costs more than over-powering it.
 */
export function decideTier(
  current: RoutedTier | undefined,
  probabilities: Record<string, number>,
): RoutedTier {
  const probability = (tier: RoutedTier): number => probabilities[tier] ?? 0;
  const mostLikely = (tiers: readonly RoutedTier[]): RoutedTier | undefined =>
    tiers.reduce<RoutedTier | undefined>(
      (best, tier) =>
        best === undefined || probability(tier) > probability(best)
          ? tier
          : best,
      undefined,
    );
  const total = (tiers: readonly RoutedTier[]): number =>
    tiers.reduce((sum, tier) => sum + probability(tier), 0);

  if (!current) {
    const best = mostLikely(ROUTED_TIERS);
    return best && probability(best) > 0 ? best : "default";
  }

  const rank = ROUTED_TIERS.indexOf(current);
  const stronger = ROUTED_TIERS.slice(rank + 1);
  if (stronger.length > 0 && total(stronger) >= UPGRADE_THRESHOLD) {
    return mostLikely(stronger) ?? current;
  }

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

interface BranchEntryLike {
  type: string;
  customType?: string;
  data?: unknown;
  message?: unknown;
}

/**
 * Tier to show when the router is selected, before any request: the latest router state for this
 * provider, else the tier of the last successful reply from this provider, else default.
 */
export function initialTierFromBranch(
  branch: readonly BranchEntryLike[],
  provider: string,
  routerId: string,
  stateEntryType: string,
  tiers: TierMap,
): RoutedTier {
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "custom" || entry.customType !== stateEntryType) {
      continue;
    }
    const data = entry.data as
      | { provider?: string; modelId?: string; state?: { tier?: string } }
      | undefined;
    const tier = data?.state?.tier as RoutedTier | undefined;
    if (
      data?.provider === provider &&
      data.modelId === routerId &&
      tier &&
      ROUTED_TIERS.includes(tier)
    ) {
      return tier;
    }
  }

  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry?.type !== "message") continue;
    const message = entry.message as
      | {
          role?: string;
          provider?: string;
          model?: string;
          thinkingLevel?: string;
          stopReason?: string;
        }
      | undefined;
    if (
      message?.role !== "assistant" ||
      message.provider !== provider ||
      message.stopReason === "error" ||
      message.stopReason === "aborted" ||
      !message.model
    ) {
      continue;
    }
    return (
      tierForModel(tiers, message.model, message.thinkingLevel) ?? "default"
    );
  }

  return "default";
}

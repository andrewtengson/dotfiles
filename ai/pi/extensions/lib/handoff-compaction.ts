export type CostTiers = {
  tiers?: Array<{ inputTokensAbove: number }>;
};

export type HandoffCompactionPromptInput = {
  skillInstructions: string;
  conversationText: string;
  previousSummary?: string;
  customInstructions?: string;
};

export function longContextInputLimit(
  cost: CostTiers | undefined,
): number | undefined {
  const thresholds = (cost?.tiers ?? [])
    .map((tier) => tier.inputTokensAbove)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (thresholds.length === 0) return undefined;
  return Math.min(...thresholds);
}

export type PricingCompactionAction =
  | "skip"
  | "compact"
  | "compact-and-continue";

export function pricingCompactionAction(input: {
  compacting: boolean;
  tokens: number | null | undefined;
  cost: CostTiers | undefined;
  reserveTokens: number;
  hasToolResults: boolean;
}): PricingCompactionAction {
  if (input.compacting) return "skip";
  if (
    !shouldCompactBeforeLongContext({
      tokens: input.tokens,
      longContextLimit: longContextInputLimit(input.cost),
      reserveTokens: input.reserveTokens,
    })
  ) {
    return "skip";
  }
  return input.hasToolResults ? "compact-and-continue" : "compact";
}

export function shouldCompactBeforeLongContext(input: {
  tokens: number | null | undefined;
  longContextLimit: number | undefined;
  reserveTokens: number;
}): boolean {
  if (
    input.tokens == null ||
    input.longContextLimit == null ||
    input.longContextLimit <= 0
  ) {
    return false;
  }
  return input.tokens > input.longContextLimit - input.reserveTokens;
}

export function buildHandoffCompactionPrompt(
  input: HandoffCompactionPromptInput,
): string {
  const sections = [
    input.skillInstructions.trim(),
    "Do not write a file. Return only the handoff document.",
    "Continue from this handoff in the same session.",
  ];
  if (input.previousSummary?.trim()) {
    sections.push(`Previous handoff:\n${input.previousSummary.trim()}`);
  }
  if (input.customInstructions?.trim()) {
    sections.push(`Additional focus:\n${input.customInstructions.trim()}`);
  }
  sections.push(`<conversation>\n${input.conversationText}\n</conversation>`);
  return sections.join("\n\n");
}

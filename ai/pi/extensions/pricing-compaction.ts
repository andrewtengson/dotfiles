/**
 * Compact with Pi's default summarizer before long-context pricing.
 *
 * Built-in auto-compact waits until contextWindow - reserveTokens.
 * This fires earlier, at the first cost.tiers[].inputTokensAbove cliff
 * minus the same reserve.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_RESERVE_TOKENS = 32768;

export type CostTiers = {
  tiers?: Array<{ inputTokensAbove: number }>;
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

function readReserveTokens(): number {
  try {
    const settings = JSON.parse(
      readFileSync(join(homedir(), ".pi/agent/settings.json"), "utf8"),
    ) as { compaction?: { reserveTokens?: number } };
    const reserve = settings.compaction?.reserveTokens;
    if (typeof reserve === "number" && reserve > 0) return reserve;
  } catch {
    // Use the repo default when settings are missing or unreadable.
  }
  return DEFAULT_RESERVE_TOKENS;
}

export default function (pi: ExtensionAPI) {
  let compacting = false;

  pi.on("turn_end", (_event, ctx) => {
    if (compacting) return;

    const tokens = ctx.getContextUsage()?.tokens;
    const longContextLimit = longContextInputLimit(ctx.model?.cost);
    const reserveTokens = readReserveTokens();
    if (
      !shouldCompactBeforeLongContext({
        tokens,
        longContextLimit,
        reserveTokens,
      })
    ) {
      return;
    }

    compacting = true;
    if (ctx.hasUI) {
      ctx.ui.notify(
        `Compacting before long-context pricing (${tokens?.toLocaleString()} / ${longContextLimit?.toLocaleString()} tokens)`,
        "info",
      );
    }

    ctx.compact({
      onComplete: () => {
        compacting = false;
        if (ctx.hasUI) ctx.ui.notify("Compaction complete", "info");
      },
      onError: (error) => {
        compacting = false;
        if (ctx.hasUI) {
          ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
        }
      },
    });
  });
}

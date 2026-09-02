/**
 * Compact with the handoff skill and resume from that handoff.
 *
 * Triggers before the active model's long-context pricing tier
 * (`model.cost.tiers[].inputTokensAbove`) so a 1M/500k window does not
 * wait until contextWindow - reserveTokens.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { uuidv7 } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  convertToLlm,
  serializeConversation,
} from "@earendil-works/pi-coding-agent";
import {
  buildHandoffCompactionPrompt,
  longContextInputLimit,
  pricingCompactionAction,
} from "./lib/handoff-compaction.js";
import { completeWithProvider } from "./lib/model-complete.js";

const DEFAULT_RESERVE_TOKENS = 32768;
const SUMMARY_MAX_TOKENS = 8192;
const CONTINUE_MESSAGE =
  "Continue from the handoff. Load any suggested skills it names, then resume the unfinished work.";

const HANDOFF_SKILL_PATHS = [
  join(homedir(), ".agents/skills/handoff/SKILL.md"),
  join(homedir(), ".pi/agent/skills/handoff/SKILL.md"),
];

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) return markdown.trim();
  const end = markdown.indexOf("\n---", 3);
  if (end < 0) return markdown.trim();
  return markdown.slice(end + 4).trim();
}

function readHandoffSkill(): string | undefined {
  for (const path of HANDOFF_SKILL_PATHS) {
    if (!existsSync(path)) continue;
    const body = stripFrontmatter(readFileSync(path, "utf8"));
    if (body) return body;
  }
  return undefined;
}

function readReserveTokens(): number {
  try {
    const settings = JSON.parse(
      readFileSync(join(homedir(), ".pi/agent/settings.json"), "utf8"),
    ) as { compaction?: { reserveTokens?: number } };
    const reserve = settings.compaction?.reserveTokens;
    if (typeof reserve === "number" && reserve > 0) return reserve;
  } catch {
    // Fall through to the settings.json default used in this repo.
  }
  return DEFAULT_RESERVE_TOKENS;
}

function assistantText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((block): block is { type: "text"; text: string } => {
      return block.type === "text" && typeof block.text === "string";
    })
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export default function (pi: ExtensionAPI) {
  let compacting = false;

  pi.on("session_before_compact", async (event, ctx) => {
    const skillInstructions = readHandoffSkill();
    if (!skillInstructions) {
      if (ctx.hasUI) {
        ctx.ui.notify(
          "Handoff skill not found; using default compaction",
          "warning",
        );
      }
      return;
    }

    const model = ctx.model;
    if (!model) return;

    const { preparation, customInstructions, signal } = event;
    const allMessages = [
      ...preparation.messagesToSummarize,
      ...preparation.turnPrefixMessages,
    ];
    if (allMessages.length === 0) return;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) return;

    const prompt = buildHandoffCompactionPrompt({
      skillInstructions,
      conversationText: serializeConversation(convertToLlm(allMessages)),
      previousSummary: preparation.previousSummary,
      customInstructions,
    });

    try {
      const response = await completeWithProvider(
        ctx.modelRegistry,
        model,
        {
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }],
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          maxTokens: SUMMARY_MAX_TOKENS,
          signal,
          cacheRetention: "none",
          sessionId: uuidv7(),
        },
      );

      if (
        response.stopReason === "error" ||
        response.stopReason === "aborted"
      ) {
        return;
      }

      const summary = assistantText(response.content);
      if (!summary) return;

      return {
        compaction: {
          summary,
          firstKeptEntryId: preparation.firstKeptEntryId,
          tokensBefore: preparation.tokensBefore,
          usage: response.usage,
          details: preparation.fileOps,
        },
      };
    } catch (error) {
      if (ctx.hasUI && !signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Handoff compaction failed: ${message}`, "error");
      }
      return;
    }
  });

  pi.on("turn_end", (event, ctx) => {
    triggerPricingCompaction(ctx, event.toolResults.length > 0);
  });

  function triggerPricingCompaction(
    ctx: ExtensionContext,
    shouldContinue: boolean,
  ): void {
    const tokens = ctx.getContextUsage()?.tokens;
    const limit = longContextInputLimit(ctx.model?.cost);
    const action = pricingCompactionAction({
      compacting,
      tokens,
      cost: ctx.model?.cost,
      reserveTokens: readReserveTokens(),
      hasToolResults: shouldContinue,
    });
    if (action === "skip") return;

    compacting = true;
    if (ctx.hasUI) {
      ctx.ui.notify(
        `Compacting before long-context pricing (${tokens?.toLocaleString()} / ${limit?.toLocaleString()} tokens)`,
        "info",
      );
    }

    ctx.compact({
      onComplete: () => {
        compacting = false;
        if (ctx.hasUI) ctx.ui.notify("Handoff compaction complete", "info");
        if (action === "compact-and-continue") {
          pi.sendUserMessage(CONTINUE_MESSAGE);
        }
      },
      onError: (error) => {
        compacting = false;
        if (ctx.hasUI) {
          ctx.ui.notify(`Handoff compaction failed: ${error.message}`, "error");
        }
      },
    });
  }
}

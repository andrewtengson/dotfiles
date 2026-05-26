/**
 * Session Summary — maintains an LLM-generated one-line session summary as the session name.
 *
 * Uses the "light" tier model from the active provider to keep costs minimal.
 * Summary appears in pi's status bar and /resume session list.
 *
 * Commands:
 *   /summary:update  — force an immediate summary update
 *   /summary:clear   — reset summary to blank
 *   /summary:cost    — show model, calls, tokens, and cost
 */

import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { complete } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { type ProviderKey, TIER_MAP } from "./lib/model-tiers.js";

const MAX_TOKENS = 300;
const TOKEN_THRESHOLD = 50_000;

interface SessionEntry {
  type: string;
  message?: {
    role?: string;
    content?: unknown;
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; text?: string; name?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    else if (b.type === "toolCall" && typeof b.name === "string")
      parts.push(`[tool: ${b.name}]`);
  }
  return parts.join("\n");
}

function buildConversation(entries: SessionEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message?.role) continue;
    const { role } = entry.message;
    if (role === "user") {
      const text = renderContent(entry.message.content).trim();
      if (text) lines.push(`User: ${text}`);
    } else if (role === "assistant") {
      const text = renderContent(entry.message.content).trim();
      if (text) lines.push(`Assistant: ${text}`);
    } else if (role === "toolResult") {
      const bytes = new TextEncoder().encode(
        renderContent(entry.message.content),
      ).length;
      lines.push(`[tool result: ${bytes}B]`);
    } else if (role === "compactionSummary") {
      const text = renderContent(entry.message.content).trim();
      if (text) lines.push(`[compaction: ${text}]`);
    }
  }
  return lines.join("\n");
}

export default function sessionSummaryExtension(pi: ExtensionAPI) {
  let lastSummary = "";
  let lastSummaryConvTokens = 0;
  let pendingCall = false;
  let firstTurnDone = false;
  let llmCallCount = 0;
  let totalTokens = { input: 0, output: 0 };
  let totalCost = 0;
  let resolvedModelName = "";

  function reset() {
    lastSummary = "";
    lastSummaryConvTokens = 0;
    pendingCall = false;
    firstTurnDone = false;
    llmCallCount = 0;
    totalTokens = { input: 0, output: 0 };
    totalCost = 0;
    resolvedModelName = "";
  }

  function resolveModel(ctx: ExtensionContext) {
    const currentModel = ctx.model;
    if (!currentModel) return undefined;

    const provider = currentModel.provider as string;
    const tierMap = TIER_MAP[provider as ProviderKey];
    if (!tierMap) return undefined;

    const fast = tierMap.fast;
    const model = ctx.modelRegistry.find(provider, fast.modelId);
    if (!model) return undefined;

    resolvedModelName = `${provider}/${fast.modelId}`;
    return model;
  }

  async function generateSummary(ctx: ExtensionContext) {
    if (pendingCall) return;

    const model = resolveModel(ctx);
    if (!model) return;

    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) return;

    // biome-ignore lint/suspicious/noExplicitAny: getBranch not in public ReadonlySessionManager type
    const branch = (ctx.sessionManager as any).getBranch() as SessionEntry[];
    const conversation = buildConversation(branch);
    if (!conversation.trim()) return;

    const convTokens = estimateTokens(conversation);
    const shouldResummarize = !lastSummary;

    const prompt = shouldResummarize
      ? [
          "Summarize this coding session in a SINGLE line (max ~80 chars).",
          "Highlight: the current problem being worked on, progress, and immediate next step.",
          "Be maximally specific and concrete.",
          "",
          "<conversation>",
          conversation,
          "</conversation>",
        ].join("\n")
      : [
          `Previous summary: <summary>${lastSummary}</summary>`,
          "",
          "New conversation since then:",
          "<conversation>",
          conversation,
          "</conversation>",
          "",
          "Update the summary ONLY if something material changed. Otherwise return it verbatim.",
          "Single line, max ~80 chars. Be specific about the current problem and progress.",
        ].join("\n");

    pendingCall = true;

    try {
      const response = await complete(
        model,
        {
          systemPrompt:
            "You are a concise summarizer. Output a single line summary of a coding session.",
          messages: [
            {
              role: "user" as const,
              content: [{ type: "text" as const, text: prompt }],
              timestamp: Date.now(),
            },
          ],
        },
        // @ts-expect-error ProviderStreamOptions accepts extra keys
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          maxTokens: MAX_TOKENS,
        },
      );

      if (response.usage) {
        totalTokens.input += response.usage.input;
        totalTokens.output += response.usage.output;
        if (response.usage.cost) totalCost += response.usage.cost.total;
      }
      llmCallCount++;

      if (response.stopReason === "error") return;

      const text = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join(" ")
        .trim()
        .replace(/\n+/g, " ");

      if (text) {
        lastSummary = text;
        lastSummaryConvTokens = convTokens;
        pi.setSessionName(lastSummary);
      }
    } catch {
      // Silently ignore — will retry next turn
    } finally {
      pendingCall = false;
    }
  }

  pi.on("session_start", async (_event, _ctx) => {
    reset();
    const name = pi.getSessionName();
    if (name) lastSummary = name;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!firstTurnDone) {
      firstTurnDone = true;
      generateSummary(ctx);
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: getBranch not in public ReadonlySessionManager type
    const branch = (ctx.sessionManager as any).getBranch() as SessionEntry[];
    const convTokens = estimateTokens(buildConversation(branch));
    if (convTokens - lastSummaryConvTokens >= TOKEN_THRESHOLD) {
      generateSummary(ctx);
    }
  });

  pi.registerCommand("summary:update", {
    description: "Force-update the session summary now",
    handler: async (_args, ctx) => {
      if (pendingCall) {
        ctx.ui.notify("Summary update already in progress", "info");
        return;
      }
      ctx.ui.notify("Generating summary...", "info");
      await generateSummary(ctx);
      if (lastSummary) ctx.ui.notify(`Summary: ${lastSummary}`, "info");
    },
  });

  pi.registerCommand("summary:clear", {
    description: "Clear the session summary",
    handler: async (_args, ctx) => {
      reset();
      pi.setSessionName("");
      ctx.ui.notify("Summary cleared", "info");
    },
  });

  pi.registerCommand("summary:cost", {
    description: "Show summary model and cost this session",
    handler: async (_args, ctx) => {
      if (!resolvedModelName) resolveModel(ctx);
      const costStr = totalCost > 0 ? `$${totalCost.toFixed(4)}` : "$0";
      ctx.ui.notify(
        `${resolvedModelName || "(none)"} | ${llmCallCount} calls | ${totalTokens.input}→${totalTokens.output} tokens | ${costStr}`,
        "info",
      );
    },
  });

  pi.registerCommand("summary:backfill", {
    description: "Backfill summaries for all unnamed sessions",
    handler: async (_args, ctx) => {
      const model = resolveModel(ctx);
      if (!model) {
        ctx.ui.notify("No summary model available", "error");
        return;
      }
      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok || !auth.apiKey) {
        ctx.ui.notify("No API key for summary model", "error");
        return;
      }

      const sessionsDir = join(getAgentDir(), "sessions");
      const projectDirs = readdirSync(sessionsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.includes("subagent"))
        .map((d) => join(sessionsDir, d.name));

      const files: string[] = [];
      for (const dir of projectDirs) {
        for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
          files.push(join(dir, f));
        }
      }

      // Filter to sessions without a meaningful session_info
      const needsSummary: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        const hasInfo = content.split("\n").some((line) => {
          if (!line.includes('"type":"session_info"')) return false;
          const entry = JSON.parse(line);
          return entry.name && !entry.name.startsWith("subagent-");
        });
        if (!hasInfo) needsSummary.push(file);
      }

      ctx.ui.notify(
        `Found ${needsSummary.length} sessions to backfill. Starting...`,
        "info",
      );

      let done = 0;
      let errors = 0;
      const CONCURRENCY = 5;

      async function processFile(file: string) {
        const content = readFileSync(file, "utf-8");
        const entries = content
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l)) as SessionEntry[];

        const conversation = buildConversation(entries);
        if (!conversation.trim() || estimateTokens(conversation) < 50) {
          done++;
          return;
        }

        // Truncate to ~8k tokens to keep costs low
        const truncated =
          conversation.length > 32000
            ? conversation.slice(0, 32000)
            : conversation;

        try {
          const response = await complete(
            model,
            {
              systemPrompt:
                "You are a concise summarizer. Output a single line summary of a coding session.",
              messages: [
                {
                  role: "user" as const,
                  content: [
                    {
                      type: "text" as const,
                      text: `Summarize this coding session in a SINGLE line (max ~80 chars). Be specific about what was worked on.\n\n<conversation>\n${truncated}\n</conversation>`,
                    },
                  ],
                  timestamp: Date.now(),
                },
              ],
            },
            // @ts-expect-error ProviderStreamOptions accepts extra keys
            { apiKey: auth.apiKey, headers: auth.headers, maxTokens: 100 },
          );

          const text = response.content
            .filter(
              (c): c is { type: "text"; text: string } => c.type === "text",
            )
            .map((c) => c.text)
            .join(" ")
            .trim()
            .replace(/\n+/g, " ");

          if (text) {
            // Find last entry id for parentId
            const lastEntry = entries[entries.length - 1];
            const parentId = (lastEntry as { id?: string }).id || null;
            const infoEntry = JSON.stringify({
              type: "session_info",
              id: crypto.randomUUID().slice(0, 8),
              parentId,
              timestamp: new Date().toISOString(),
              name: text,
            });
            appendFileSync(file, `\n${infoEntry}`);
          }
          done++;
        } catch {
          errors++;
        }
      }

      // Process in batches of CONCURRENCY
      for (let i = 0; i < needsSummary.length; i += CONCURRENCY) {
        const batch = needsSummary.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(processFile));
        if ((done + errors) % 20 === 0) {
          ctx.ui.notify(
            `Progress: ${done + errors}/${needsSummary.length} (${errors} errors)`,
            "info",
          );
        }
      }

      ctx.ui.notify(
        `Backfill complete: ${done} named, ${errors} errors, ${needsSummary.length} total`,
        "info",
      );
    },
  });
}

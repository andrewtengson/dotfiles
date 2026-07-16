/**
 * Model Router — auto-routes to heavy/default/light tier based on task intent.
 *
 * Routes within the currently active provider (amazon-bedrock, openai-codex, or kiro).
 * If the target model isn't available, stays on the current model silently.
 *
 * Commands:
 *   /model-router        — show status and current route map
 *   /model-router-auto   — toggle auto-routing: /model-router-auto on|off
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  type ProviderKey,
  resolveTierMap,
  type ThinkingLevel,
  TIER_MAP,
  type Tier,
} from "./lib/model-tiers.js";

// ---------------------------------------------------------------------------
// Intent detection — keyword matching to determine tier
// ---------------------------------------------------------------------------

// Heavy tier: deep reasoning, multi-step planning, investigation
// Triggers when problem is open-ended, requires strategy, or has high operational complexity
// Sources: Continue.dev autodetect.ts, Aider models.py, ClaudeGuide regex patterns, Haimaker router
const HEAVY_KEYWORDS = [
  // Architecture & design
  "architecture",
  "architect",
  "design a system",
  "design system",
  "system design",
  "data model",
  "schema design",
  "api design",
  "design pattern",
  // Debugging & investigation
  "debug",
  "root cause",
  "investigate",
  "diagnose",
  "troubleshoot",
  "track down",
  "figure out why",
  "explain why",
  "why does",
  "how does",
  "broken",
  // Code review
  "code review",
  "pr review",
  "pull request",
  "diff",
  "refactor",
  "synthesize",
  // Concurrency & distributed
  "race condition",
  "deadlock",
  "concurrency",
  "distributed",
  "consensus",
  "eventual consistency",
  // Performance & optimization
  "performance",
  "optimize",
  "profiling",
  "bottleneck",
  "memory leak",
  "latency",
  // Security
  "security audit",
  "threat model",
  "vulnerability",
  "exploit",
  "pen test",
  // Strategic planning
  "migration",
  "tradeoff",
  "trade-off",
  "pros and cons",
  "compare approaches",
  "evaluate options",
  // Large scope
  "refactor entire",
  "rewrite",
  "overhaul",
  "redesign",
  "rearchitect",
  "implement from scratch",
  "support sso",
  // Complexity signals
  "complex",
  "deeply",
  "analyze",
  "in depth",
  "thorough",
  "comprehensive",
  "end to end",
  "from scratch",
];

// Light tier: bounded, specific, low operational complexity (1-3 steps)
// Triggers for tasks where speed matters more than reasoning depth
// Sources: OpenClaw messageRouting docs, ClaudeGuide SIMPLE_KEYWORDS
const LIGHT_KEYWORDS = [
  // Summaries & explanations
  "summarize",
  "summary",
  "boil down",
  "tldr",
  "explain briefly",
  "what is",
  "what does",
  "what's",
  "what is the",
  "define",
  "describe",
  // Classification & extraction (bounded, single-pass)
  "classify",
  "categorize",
  "extract",
  "translate",
  "yes or no",
  "true or false",
  // Quick edits
  "quick fix",
  "rename",
  "one-liner",
  "typo",
  "fix the import",
  "add import",
  "remove import",
  "update the version",
  // Trivial scope
  "simple",
  "tiny",
  "minor",
  "small change",
  "just update",
  "just add",
  "just remove",
  "just change",
  // Boilerplate & scaffolding
  "boilerplate",
  "scaffold",
  "template",
  "stub",
  "placeholder",
  "skeleton",
  // Formatting & style
  "format",
  "lint",
  "prettier",
  "indent",
  "style fix",
  // Documentation
  "add a comment",
  "add comments",
  "docstring",
  "jsdoc",
  "document this",
  // Read & inspect (specific enough to be unambiguous)
  "show me",
  "check if",
  "look at",
  // Conversational
  "thanks",
  "thank you",
  "got it",
  "never mind",
  "nvm",
];

function detectTier(prompt: string): Tier | undefined {
  const text = prompt.toLowerCase();

  const matchesWithBoundary = (keywords: string[]) =>
    keywords.filter((kw) =>
      new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
        text,
      ),
    );

  const heavyMatches = matchesWithBoundary(HEAVY_KEYWORDS);
  const lightMatches = matchesWithBoundary(LIGHT_KEYWORDS);

  // Require 2+ matches for high confidence, 1 for medium
  if (heavyMatches.length >= 2) return "heavy";
  if (lightMatches.length >= 2) return "light";
  if (heavyMatches.length === 1 && lightMatches.length === 0) return "heavy";
  if (lightMatches.length === 1 && heavyMatches.length === 0) return "light";

  return undefined; // ambiguous or no signal → stay on current model
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared state — exposed via globalThis for cross-extension reads (editor)
// ---------------------------------------------------------------------------

const ROUTER_STATE_KEY = Symbol.for("model-router-state");

interface RouterState {
  autoRoutingEnabled: boolean;
  lastTier?: Tier;
  routed: boolean; // true if current turn was routed away from default
  preRouteModel?: {
    provider: ProviderKey;
    modelId: string;
    thinkingLevel: ThinkingLevel;
  };
}

function exposeState(state: RouterState): void {
  // biome-ignore lint/suspicious/noExplicitAny: globalThis symbol access
  (globalThis as any)[ROUTER_STATE_KEY] = state;
}

function currentProvider(ctx: ExtensionContext): ProviderKey | undefined {
  const provider = ctx.model?.provider;
  if (provider && provider in TIER_MAP) return provider as ProviderKey;
  return undefined;
}

function currentModelText(ctx: ExtensionContext): string {
  const model = ctx.model;
  if (!model) return "none";
  return `${model.provider}/${model.id}`;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function modelRouterExtension(pi: ExtensionAPI): void {
  const state: RouterState = { autoRoutingEnabled: false, routed: false };
  exposeState(state);

  async function trySwitchModel(
    ctx: ExtensionContext,
    provider: ProviderKey,
    modelId: string,
    thinkingLevel: ThinkingLevel,
  ): Promise<boolean> {
    const model = ctx.modelRegistry.find(provider, modelId);
    if (!model) return false;

    const ok = await pi.setModel(model);
    if (!ok) return false;

    pi.setThinkingLevel(thinkingLevel);
    return true;
  }

  function updateStatus(ctx: ExtensionContext): void {
    const auto = state.autoRoutingEnabled ? "on" : "off";
    ctx.ui.setStatus(
      "model-router",
      `router:${auto} | ${currentModelText(ctx)}`,
    );
  }

  // --- Events ---

  pi.on("session_start", async (_event, ctx) => updateStatus(ctx));
  pi.on("model_select", async (_event, ctx) => updateStatus(ctx));

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.autoRoutingEnabled) return;

    const provider = currentProvider(ctx);
    if (!provider) return;

    const tier = detectTier(event.prompt);
    if (!tier) return;

    const routes = resolveTierMap(provider, ctx.model?.id);
    const target = routes[tier];
    const current = ctx.model;
    const currentThinking = pi.getThinkingLevel() as ThinkingLevel;

    // Don't downgrade if context exceeds 80% of target model's window
    const contextUsage = ctx.getContextUsage();
    if (contextUsage?.tokens != null) {
      const targetModel = ctx.modelRegistry.find(provider, target.modelId);
      if (
        targetModel &&
        contextUsage.tokens > targetModel.contextWindow * 0.8
      ) {
        return;
      }
    }

    // Already on the target model and thinking — nothing to do
    if (
      current?.id === target.modelId &&
      currentThinking === target.thinkingLevel
    ) {
      return;
    }

    // Capture pre-route state for restore
    state.preRouteModel = {
      provider: provider,
      modelId: current?.id ?? target.modelId,
      thinkingLevel: currentThinking,
    };

    // Same model, different thinking — only adjust thinking
    if (current?.id === target.modelId) {
      pi.setThinkingLevel(target.thinkingLevel);
      state.routed = true;
      return;
    }

    // Different model — full switch
    const switched = await trySwitchModel(
      ctx,
      provider,
      target.modelId,
      target.thinkingLevel,
    );
    if (!switched) {
      state.preRouteModel = undefined;
      return;
    }

    state.lastTier = tier;
    state.routed = true;
    updateStatus(ctx);
    ctx.ui.notify(`Model (auto): ${target.modelId}`, "info");
  });

  // Restore default model after each agent turn completes
  pi.on("message_end", async (event, ctx) => {
    if (!state.autoRoutingEnabled || !state.routed) return;
    if (event.message.role !== "assistant") return;
    // Don't restore mid-turn (toolUse means more tool calls coming)
    // biome-ignore lint/suspicious/noExplicitAny: pi SDK message type lacks stopReason
    if ((event.message as any).stopReason === "toolUse") return;

    const restore = state.preRouteModel;
    if (!restore) {
      state.routed = false;
      return;
    }

    // Always restore both model and thinking
    const current = ctx.model;
    if (current?.id !== restore.modelId) {
      await trySwitchModel(
        ctx,
        restore.provider,
        restore.modelId,
        restore.thinkingLevel,
      );
    } else if (pi.getThinkingLevel() !== restore.thinkingLevel) {
      pi.setThinkingLevel(restore.thinkingLevel);
    }

    state.routed = false;
    state.preRouteModel = undefined;
    state.lastTier = undefined;
    updateStatus(ctx);
  });

  // --- Commands ---

  pi.registerCommand("model-router", {
    description: "Show model router status and route map",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const provider = currentProvider(ctx) ?? "amazon-bedrock";
      const routes = resolveTierMap(provider, ctx.model?.id);
      const lines = [
        `auto-routing: ${state.autoRoutingEnabled ? "on" : "off"}`,
        `current: ${currentModelText(ctx)}`,
        `provider: ${provider}`,
        "",
        `heavy   → ${routes.heavy.modelId} (thinking: ${routes.heavy.thinkingLevel})`,
        `default → ${routes.default.modelId} (thinking: ${routes.default.thinkingLevel})`,
        `light   → ${routes.light.modelId} (thinking: ${routes.light.thinkingLevel})`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand("model-router-auto", {
    description: "Toggle auto-routing: /model-router-auto on|off",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const value = args.trim().toLowerCase();
      if (value !== "on" && value !== "off") {
        ctx.ui.notify("Usage: /model-router-auto on|off", "warning");
        return;
      }
      state.autoRoutingEnabled = value === "on";
      updateStatus(ctx);
      ctx.ui.notify(
        `Model auto-routing ${state.autoRoutingEnabled ? "enabled" : "disabled"}`,
        "info",
      );
    },
  });
}

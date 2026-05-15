/**
 * Subagent Model Router — sets subagent model overrides based on the active provider.
 *
 * Writes subagents.agentOverrides to settings.json on session_start and model_select.
 * pi-subagents reads settings fresh per launch, so overrides apply immediately.
 *
 * Tier mapping per subagent role:
 *   heavy  → oracle, planner, researcher
 *   default → worker, reviewer, delegate
 *   light  → scout, context-builder
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { TIER_MAP, type ProviderKey, type Tier } from "./lib/model-tiers.js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Subagent role → tier mapping
// Modeled after Amp's subagent modes:
//   Review (bug identification, code review)    → default (Sonnet/5.4-mini)
//   Search (fast codebase retrieval)            → light (Haiku/Spark)
//   Oracle (complex reasoning & planning)       → heavy (Opus/5.5)
//   Librarian (large-scale retrieval, research) → default (Sonnet/5.4-mini)
const AGENT_TIERS: Record<string, Tier> = {
  // Heavy: complex reasoning, planning, deep thinking
  oracle: "heavy",
  planner: "heavy",
  reviewer: "heavy",
  worker: "heavy",
  // Default: research, implementation, general work
  researcher: "default",
  delegate: "default",
  // Light: fast retrieval, scouting, context gathering
  scout: "light",
  "context-builder": "light",
};

function getSettingsPath(): string {
  return join(homedir(), ".pi", "agent", "settings.json");
}

function writeOverrides(provider: ProviderKey): void {
  const settingsPath = getSettingsPath();
  let settings: Record<string, any>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    settings = {};
  }

  const overrides: Record<string, Record<string, any>> = {};
  for (const [agent, tier] of Object.entries(AGENT_TIERS)) {
    const target = TIER_MAP[provider][tier];
    overrides[agent] = {
      model: `${provider}/${target.modelId}`,
      thinking: target.thinkingLevel,
    };
  }

  if (!settings.subagents || typeof settings.subagents !== "object") {
    settings.subagents = {};
  }

  // Deep merge: preserve manual per-agent overrides (like output: false)
  const existing = (settings.subagents.agentOverrides ?? {}) as Record<
    string,
    Record<string, any>
  >;
  for (const [agent, managed] of Object.entries(overrides)) {
    existing[agent] = { ...existing[agent], ...managed };
  }
  settings.subagents.agentOverrides = existing;

  writeFileSync(
    settingsPath,
    JSON.stringify(settings, null, 2) + "\n",
    "utf-8",
  );
}

function getProvider(ctx: ExtensionContext): ProviderKey | undefined {
  const p = ctx.model?.provider;
  if (p === "amazon-bedrock" || p === "openai-codex") return p;
  return undefined;
}

export default function (pi: ExtensionAPI): void {
  let lastProvider: ProviderKey | undefined;

  function syncOverrides(ctx: ExtensionContext): void {
    const provider = getProvider(ctx);
    if (!provider || provider === lastProvider) return;
    lastProvider = provider;
    writeOverrides(provider);
  }

  pi.on("session_start", async (_event, ctx) => syncOverrides(ctx));
  pi.on("model_select", async (_event, ctx) => syncOverrides(ctx));
}

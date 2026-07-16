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

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  type ProviderKey,
  resolveTierMap,
  TIER_MAP,
  type Tier,
} from "./lib/model-tiers.js";

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
  // Default: research, implementation, general work
  researcher: "default",
  delegate: "default",
  worker: "default",
  // Light: fast retrieval, scouting, context gathering
  scout: "light",
  "context-builder": "light",
};

function getSettingsPath(): string {
  return join(homedir(), ".pi", "agent", "settings.json");
}

function writeOverrides(provider: ProviderKey, activeModelId?: string): void {
  const settingsPath = getSettingsPath();
  // biome-ignore lint/suspicious/noExplicitAny: JSON settings file
  let settings: Record<string, any>;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    settings = {};
  }

  const tierMap = resolveTierMap(provider, activeModelId);
  // biome-ignore lint/suspicious/noExplicitAny: dynamic override shape
  const overrides: Record<string, Record<string, any>> = {};
  for (const [agent, tier] of Object.entries(AGENT_TIERS)) {
    const target = tierMap[tier];
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
    // biome-ignore lint/suspicious/noExplicitAny: dynamic override shape
    Record<string, any>
  >;
  for (const [agent, managed] of Object.entries(overrides)) {
    existing[agent] = { ...existing[agent], ...managed };
  }
  settings.subagents.agentOverrides = existing;

  writeFileSync(
    settingsPath,
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf-8",
  );
}

function getProvider(ctx: ExtensionContext): ProviderKey | undefined {
  const p = ctx.model?.provider;
  if (p && p in TIER_MAP) return p as ProviderKey;
  return undefined;
}

export default function (pi: ExtensionAPI): void {
  function syncOverrides(ctx: ExtensionContext): void {
    const provider = getProvider(ctx);
    if (!provider) return;

    // Check if existing overrides already match the current tier config; skip if so
    try {
      const settings = JSON.parse(readFileSync(getSettingsPath(), "utf-8"));
      const existing = settings.subagents?.agentOverrides ?? {};
      const tierMap = resolveTierMap(provider, ctx.model?.id);
      const heavyTarget = tierMap.heavy;
      const expectedHeavyModel = `${provider}/${heavyTarget.modelId}`;
      if (existing.oracle?.model === expectedHeavyModel) return;
    } catch {}

    writeOverrides(provider, ctx.model?.id);
  }

  pi.on("session_start", async (_event, ctx) => syncOverrides(ctx));
  pi.on("model_select", async (_event, ctx) => syncOverrides(ctx));
}

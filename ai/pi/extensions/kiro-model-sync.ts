/**
 * Kiro Model Sync — keeps the pi-provider-kiro model catalog fresh on startup.
 *
 * Problem: pi-provider-kiro ships a hardcoded fallback model list and lazily
 * refreshes a runtime cache (~/.kiro-models-cache.json) from the Kiro
 * ListAvailableModels API. That refresh only fires after login or a chat
 * request, is fire-and-forget, and — for IdC/SSO subscription tokens — the
 * ListAvailableModels endpoint returns 403 or an empty list, so the cache is
 * often never written. pi validates `enabledModels` and builds its model list
 * from the provider's registered models at startup; with no cache it falls back
 * to the stale hardcoded array, producing "No models match pattern" warnings
 * for newly released models (e.g. claude-sonnet-5).
 *
 * Fix: this async extension factory runs BEFORE pi-provider-kiro registers its
 * provider (pi awaits async factories before flushing queued provider
 * registrations). It sources the model list + context windows from
 * `kiro-cli chat --list-models --format json` (which works regardless of the
 * ListAvailableModels authorization quirk), and enriches each model with the
 * fields the CLI does NOT report (max output tokens, reasoning, image input)
 * by importing the provider's OWN kiroModels definitions — so the result
 * matches the provider exactly and auto-tracks provider upgrades. Models the
 * provider doesn't yet define fall back to heuristics. It writes
 * ~/.kiro-models-cache.json under the us-east-1 API region key; the provider's
 * getCachedModels() then serves this fresh list to pi's startup validation and
 * in-session model picker. kiro-cli is invoked at most once per day (cache
 * TTL); most launches read the existing fresh cache and do no work.
 *
 * Region: cached under us-east-1, the API region the provider resolves to for
 * us-* and ap-* SSO logins (via its API_REGION_MAP). EU identity centers
 * resolve to eu-central-1 and are not covered here; if you ever log in through
 * an EU SSO instance, add that region.
 *
 * Fails open: any error leaves the provider's own fallback behavior intact.
 *
 * Runs only when kiro is the active provider (settings.json defaultProvider is
 * "kiro" or defaultModel targets kiro), so it never shells out to kiro-cli on
 * setups that don't use the provider.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CACHE_PATH = join(homedir(), ".kiro-models-cache.json");
const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");
// The provider's own compiled model definitions, used as the source of truth
// for maxTokens/input/reasoning (fields kiro-cli does not report).
const PROVIDER_ENTRY = join(
  homedir(),
  ".pi",
  "agent",
  "npm",
  "node_modules",
  "pi-provider-kiro",
  "dist",
  "index.js",
);
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // once per day; kiro-cli is only invoked when the cache is older
const CLI_TIMEOUT_MS = 15_000;
// The Q API region the provider resolves to for us-* and ap-* SSO logins.
const API_REGION = "us-east-1";

const PROVIDER_THINKING_ORIGINAL =
  "const thinkingEnabled = !!options?.reasoning || model.reasoning;";
const PROVIDER_THINKING_PATCHED =
  'const thinkingEnabled = !model.id.startsWith("gpt-") && (!!options?.reasoning || model.reasoning);';

export const patchProviderReasoningSource = (
  source: string,
): { source: string; changed: boolean } => {
  if (source.includes(PROVIDER_THINKING_PATCHED)) {
    return { source, changed: false };
  }
  if (!source.includes(PROVIDER_THINKING_ORIGINAL)) {
    throw new Error("Unsupported pi-provider-kiro thinking implementation");
  }
  return {
    source: source.replace(
      PROVIDER_THINKING_ORIGINAL,
      PROVIDER_THINKING_PATCHED,
    ),
    changed: true,
  };
};

const patchInstalledProviderReasoning = (): void => {
  if (!existsSync(PROVIDER_ENTRY)) return;
  const source = readFileSync(PROVIDER_ENTRY, "utf8");
  const patched = patchProviderReasoningSource(source);
  if (patched.changed) writeFileSync(PROVIDER_ENTRY, patched.source, "utf8");
};

interface ModelMeta {
  maxTokens: number;
  reasoning: boolean;
  image: boolean;
}

// Load the provider's own kiroModels array (by absolute path in pi's managed
// npm tree) and index the metadata the CLI omits, keyed by pi id. Importing
// the module only runs its pure init (builds the model array) — it does not
// register the provider, which happens in the default export pi calls. Returns
// an empty map if the provider can't be loaded; callers fall back to
// heuristics. Best-effort; never throws.
const loadProviderMeta = async (): Promise<Record<string, ModelMeta>> => {
  const meta: Record<string, ModelMeta> = {};
  try {
    if (!existsSync(PROVIDER_ENTRY)) return meta;
    const mod = (await import(PROVIDER_ENTRY)) as {
      kiroModels?: Array<{
        id: string;
        maxTokens?: number;
        reasoning?: boolean;
        input?: string[];
      }>;
    };
    for (const m of mod.kiroModels ?? []) {
      if (!m?.id) continue;
      meta[m.id] = {
        maxTokens: m.maxTokens ?? 65536,
        reasoning: Boolean(m.reasoning),
        image: Array.isArray(m.input) && m.input.includes("image"),
      };
    }
  } catch {
    // fall through to heuristics
  }
  return meta;
};

interface KiroCliModel {
  model_id: string;
  model_name: string;
  context_window_tokens: number;
}
interface KiroCliResponse {
  models: KiroCliModel[];
}

// pi provider model shape (matches pi-provider-kiro's kiroModels entries).
interface KiroProviderModel {
  id: string;
  name: string;
  api: "kiro-api";
  provider: "kiro";
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: 0; output: 0; cacheRead: 0; cacheWrite: 0 };
  contextWindow: number;
  maxTokens: number;
}

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as const;

// kiro id (dots in version) -> pi id (dashes): claude-sonnet-4.5 -> claude-sonnet-4-5
const toPiId = (modelId: string): string =>
  modelId.replace(/(\d)\.(\d)/g, "$1-$2");

// Explicit, docs-verified metadata for models kiro-cli exposes but the
// provider's kiroModels does NOT yet define. Consulted before the generic
// heuristic so per-model differences the heuristic can't infer (e.g.
// sonnet-5's 128K output vs opus-4-5's 64K) survive daily cache refreshes.
// Sourced from the official model docs:
//   - GPT-5.6 (sol/terra/luna): 128K output, reasoning, text+image
//     https://developers.openai.com/api/docs/models/gpt-5.6-luna
//   - Claude Sonnet 5: 128K output, adaptive thinking, text+image
//     https://platform.claude.com/docs/en/about-claude/models/overview
//   - Claude Opus 4.5: 64K output, text+image
//     https://www.anthropic.com/news/claude-opus-4-5
// Remove an entry once the provider ships its own definition (providerMeta
// takes precedence, so a stale entry here is harmless but redundant).
const KNOWN_META: Record<string, ModelMeta> = {
  "gpt-5-6-sol": { maxTokens: 128000, reasoning: true, image: true },
  "gpt-5-6-terra": { maxTokens: 128000, reasoning: true, image: true },
  "gpt-5-6-luna": { maxTokens: 128000, reasoning: true, image: true },
  "claude-sonnet-5": { maxTokens: 128000, reasoning: true, image: true },
  "claude-opus-4-5": { maxTokens: 65536, reasoning: true, image: true },
};

// Heuristics for models neither the provider nor KNOWN_META define yet.
// Claude gets a 64K output budget; GPT-5+ reasoning models get 128K; both
// support image input. Everything else is a smaller text-only model.
const heuristicMeta = (piId: string): ModelMeta => {
  const isClaude = piId.startsWith("claude");
  // GPT-5 and newer reasoning models (kiro id "gpt-5.6-*" -> pi id "gpt-5-6-*").
  const isGpt5Plus = /^gpt-([5-9]|\d{2,})/.test(piId);
  let maxTokens = 8192;
  if (isGpt5Plus) maxTokens = 128000;
  else if (isClaude) maxTokens = 65536;
  return {
    maxTokens,
    reasoning:
      isGpt5Plus ||
      piId.includes("opus") ||
      piId.includes("sonnet") ||
      piId.includes("coder") ||
      piId.includes("deepseek"),
    image: isClaude || isGpt5Plus,
  };
};

const toProviderModel = (
  m: KiroCliModel,
  baseUrl: string,
  providerMeta: Record<string, ModelMeta>,
): KiroProviderModel => {
  const piId = toPiId(m.model_id);
  const meta = providerMeta[piId] ?? KNOWN_META[piId] ?? heuristicMeta(piId);
  return {
    id: piId,
    name: m.model_name || m.model_id,
    api: "kiro-api",
    provider: "kiro",
    baseUrl,
    reasoning: meta.reasoning,
    input: meta.image ? ["text", "image"] : ["text"],
    cost: ZERO_COST,
    contextWindow: m.context_window_tokens,
    maxTokens: meta.maxTokens,
  };
};

const cacheIsFresh = (region: string): boolean => {
  if (!existsSync(CACHE_PATH)) return false;
  try {
    const data = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    if (!Array.isArray(data?.[region]) || data[region].length === 0) {
      return false;
    }
    return Date.now() - statSync(CACHE_PATH).mtimeMs < REFRESH_TTL_MS;
  } catch {
    return false;
  }
};

const fetchModelsFromCli = (): KiroCliModel[] => {
  const raw = execFileSync(
    "kiro-cli",
    ["chat", "--list-models", "--format", "json"],
    { encoding: "utf8", timeout: CLI_TIMEOUT_MS },
  );
  const parsed = JSON.parse(raw) as KiroCliResponse;
  if (!Array.isArray(parsed.models)) {
    throw new Error("kiro-cli returned no models array");
  }
  return parsed.models;
};

const writeCache = (region: string, models: KiroProviderModel[]): void => {
  let cache: Record<string, unknown> = {};
  if (existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_PATH, "utf8"));
    } catch {
      cache = {};
    }
  }
  cache[region] = models;
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
};

// Only sync when kiro is the active provider. At factory time (before
// session_start) ctx.model is unavailable, so read the configured default from
// settings.json: either defaultProvider is "kiro" or defaultModel is namespaced
// to kiro ("kiro/..."). Bare model ids fall back to the defaultProvider check.
const kiroIsActiveProvider = (): boolean => {
  try {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8")) as {
      defaultProvider?: string;
      defaultModel?: string;
    };
    if (settings.defaultModel?.includes("/")) {
      return settings.defaultModel.startsWith("kiro/");
    }
    return settings.defaultProvider === "kiro";
  } catch {
    return false;
  }
};

const syncKiroModels = async (): Promise<void> => {
  if (cacheIsFresh(API_REGION)) return;

  const cliModels = fetchModelsFromCli();
  if (cliModels.length === 0) return;

  const providerMeta = await loadProviderMeta();
  const baseUrl = `https://q.${API_REGION}.amazonaws.com/generateAssistantResponse`;
  const providerModels = cliModels.map((m) =>
    toProviderModel(m, baseUrl, providerMeta),
  );
  writeCache(API_REGION, providerModels);
};

// Async factory: pi awaits this before flushing pi-provider-kiro's provider
// registration, so the fresh cache is in place before startup model validation.
export default async function (_pi: ExtensionAPI): Promise<void> {
  // pi-provider-kiro treats `reasoning: true` as permission to inject
  // Claude-style visible-thinking tags. Kiro GPT-5.6 reasoning is hidden and
  // has no configurable /effort schema, so keep reasoning metadata for Pi's
  // UI while excluding GPT from the provider's Claude-specific prompt path.
  // Reapplied after every package upgrade before the provider registers.
  try {
    patchInstalledProviderReasoning();
  } catch {
    // Fail open if a provider upgrade changes the implementation shape.
  }

  try {
    if (!kiroIsActiveProvider()) return;
    await syncKiroModels();
  } catch {
    // Fail open: leave the provider's own fallback / lazy refresh untouched.
  }
}

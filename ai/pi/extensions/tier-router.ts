/**
 * Tier router: registers `<provider>/router` virtual models that route each new user message to the
 * provider's heavy, default, or light tier (lib/model-tiers.ts) using the Jev classifier.
 *
 *   heavy   - complex reasoning, planning, deep thinking
 *   default - research, implementation, general work
 *   light   - fast retrieval, scouting, context gathering
 *
 * Select `kiro/router` (or another provider's) in /model to turn routing on; select any physical
 * model to turn it off. Tool-call continuations and retries stay on the model that handled the turn
 * so prompt caches and thinking signatures stay valid. The classifier sees only the latest prompt,
 * the two previous user messages, and the last assistant reply's text (see lib/tier-router.ts).
 *
 * Requires TypeSafe credentials. Without them, or when Jev fails, the router keeps the current tier.
 */

import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  ExtensionAPI,
  ExtensionContext,
  ModelRoute,
  ModelRouteRequest,
} from "@earendil-works/pi-coding-agent";
import {
  type ProviderKey,
  resolveTierMap,
  type TierMap,
} from "./lib/model-tiers.js";
import {
  buildClassifierState,
  decideTier,
  type RoutedTier,
  readTierAnswer,
  TIER_QUESTION,
  tierForModel,
} from "./lib/tier-router.js";

const ROUTER_ID = "router";
const CLASSIFY_TIMEOUT_MS = 1_500;

/** Providers that get a router. */
const ROUTED_PROVIDERS: readonly ProviderKey[] = [
  "kiro",
  "openai-codex",
  "azure-openai-responses",
  "amazon-bedrock",
  "xai",
];

interface RouterState {
  tier: RoutedTier;
}

type RouterRequest = ModelRouteRequest<RouterState>;

/** Shared with editor.ts to show the routed model in the status line. */
const ROUTE_INFO_KEY = Symbol.for("tier-router-route");

interface RouteInfo {
  tier: RoutedTier;
  modelId: string;
}

function publishRoute(info: RouteInfo): void {
  (globalThis as Record<symbol, unknown>)[ROUTE_INFO_KEY] = info;
}

function findModel(
  ctx: ExtensionContext,
  provider: ProviderKey,
  tiers: TierMap,
  tier: RoutedTier,
): Model<Api> | undefined {
  return ctx.modelRegistry.find(provider, tiers[tier].modelId);
}

function route(
  ctx: ExtensionContext,
  provider: ProviderKey,
  tiers: TierMap,
  tier: RoutedTier,
  state?: RouterState,
): ModelRoute<RouterState> {
  const model =
    findModel(ctx, provider, tiers, tier) ??
    findModel(ctx, provider, tiers, "default");
  if (!model) {
    throw new Error(
      `Tier router: no ${tier} or default model for ${provider} in the catalog`,
    );
  }
  publishRoute({ tier, modelId: model.id });
  return { model, thinkingLevel: tiers[tier].thinkingLevel, state };
}

/** Tier the session is on: router state, else inferred from the last physical response. */
function currentTier(
  request: RouterRequest,
  tiers: TierMap,
): RoutedTier | undefined {
  if (request.state) return request.state.tier;
  const previous = request.previous;
  if (!previous) return undefined;
  return tierForModel(tiers, previous.model.id, previous.thinkingLevel);
}

async function classifyTier(
  request: RouterRequest,
  ctx: ExtensionContext,
  current: RoutedTier | undefined,
): Promise<RoutedTier | undefined> {
  const jev = ctx.modelRegistry.findOfType(
    "classifier",
    "typesafe",
    "jev-latest",
  );
  if (!jev) return undefined;

  const timeout = AbortSignal.timeout(CLASSIFY_TIMEOUT_MS);
  const signal = request.signal
    ? AbortSignal.any([request.signal, timeout])
    : timeout;

  try {
    const result = await ctx.modelRegistry.classify(
      jev,
      {
        state: buildClassifierState(request.messages, current),
        questions: { tier: TIER_QUESTION },
      },
      { signal },
    );
    const probabilities = readTierAnswer(result);
    if (!probabilities) {
      console.warn(
        `[tier-router] classifier returned no answer: ${result.errorMessage ?? result.stopReason}`,
      );
      return undefined;
    }
    return decideTier(current, probabilities);
  } catch (error) {
    console.warn(`[tier-router] classifier failed: ${String(error)}`);
    return undefined;
  }
}

function registerRouter(pi: ExtensionAPI, provider: ProviderKey): void {
  const tiers = resolveTierMap(provider);

  pi.registerVirtualModel<RouterState>({
    provider,
    id: ROUTER_ID,
    name: "Router (Jev)",
    // A single level: each tier sets its own thinking level.
    thinkingLevels: ["medium"],
    async route(request, ctx) {
      // Compaction summaries and other out-of-loop requests use the light tier.
      if (request.reason === "direct")
        return route(ctx, provider, tiers, "light");

      const current = currentTier(request, tiers);

      // Within a turn, keep the physical model so caches and signatures stay valid.
      if (request.reason !== "user" && current) {
        const sticky = request.failed ?? request.previous;
        if (sticky) {
          publishRoute({ tier: current, modelId: sticky.model.id });
          return {
            model: sticky.model,
            thinkingLevel: sticky.thinkingLevel ?? tiers[current].thinkingLevel,
          };
        }
      }

      const next =
        (request.reason === "user"
          ? await classifyTier(request, ctx, current)
          : undefined) ??
        current ??
        "default";
      const state = next === request.state?.tier ? undefined : { tier: next };
      return route(ctx, provider, tiers, next, state);
    },
  });
}

export default function tierRouterExtension(pi: ExtensionAPI): void {
  for (const provider of ROUTED_PROVIDERS) registerRouter(pi, provider);
}

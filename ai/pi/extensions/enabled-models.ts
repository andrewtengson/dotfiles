/**
 * Enabled Models — keeps `enabledModels` in settings.json aligned with the
 * regularly-used models of the active provider.
 *
 * Writes on session_start and model_select. pi reads `enabledModels` at session
 * start, so a provider switch takes effect on the next session.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { PROVIDER_MODELS, resolveEnabledModels } from "./lib/enabled-models.js";
import type { ProviderKey } from "./lib/model-tiers.js";

function getSettingsPath(): string {
  return join(homedir(), ".pi", "agent", "settings.json");
}

function getProvider(ctx: ExtensionContext): ProviderKey | undefined {
  const provider = ctx.model?.provider;
  if (provider && provider in PROVIDER_MODELS) return provider as ProviderKey;
  return undefined;
}

export default function enabledModelsExtension(pi: ExtensionAPI): void {
  function sync(ctx: ExtensionContext): void {
    const provider = getProvider(ctx);
    if (!provider) return;

    // Written unfiltered: the model catalogue may not have refreshed yet at
    // session start, and pi ignores patterns that match nothing.
    const desired = resolveEnabledModels(provider);
    if (desired.length === 0) return;

    const settingsPath = getSettingsPath();
    // biome-ignore lint/suspicious/noExplicitAny: JSON settings file
    let settings: Record<string, any>;
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch (error) {
      ctx.ui.notify(
        `enabled-models: cannot read settings.json (${String(error)})`,
        "warning",
      );
      return;
    }

    const current = settings.enabledModels;
    if (
      Array.isArray(current) &&
      current.length === desired.length &&
      current.every((value, index) => value === desired[index])
    ) {
      return;
    }

    settings.enabledModels = desired;
    try {
      writeFileSync(
        settingsPath,
        `${JSON.stringify(settings, null, 2)}\n`,
        "utf-8",
      );
    } catch (error) {
      ctx.ui.notify(
        `enabled-models: cannot write settings.json (${String(error)})`,
        "warning",
      );
    }
  }

  pi.on("session_start", async (_event, ctx) => sync(ctx));
  pi.on("model_select", async (_event, ctx) => sync(ctx));
}

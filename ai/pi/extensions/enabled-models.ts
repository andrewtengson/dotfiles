/**
 * Enabled Models — keeps `enabledModels` in settings.json aligned with the
 * regularly-used models of the configured `defaultProvider`.
 *
 * Written on session_start only, and keyed off the `defaultProvider` setting
 * rather than the live model: pi resolves the startup model from the first
 * scoped entry before falling back to `defaultModel`, so syncing from the
 * active model would pin whichever provider the scope happened to select.
 *
 * pi reads `enabledModels` at session start, so a provider change takes effect
 * on the next session.
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

const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

interface Settings {
  defaultProvider?: string;
  defaultModel?: string;
  enabledModels?: string[];
  [key: string]: unknown;
}

function sameList(current: unknown, desired: string[]): boolean {
  return (
    Array.isArray(current) &&
    current.length === desired.length &&
    current.every((value, index) => value === desired[index])
  );
}

export default function enabledModelsExtension(pi: ExtensionAPI): void {
  function sync(ctx: ExtensionContext): void {
    let settings: Settings;
    try {
      settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Settings;
    } catch (error) {
      ctx.ui.notify(
        `enabled-models: cannot read settings.json (${String(error)})`,
        "warning",
      );
      return;
    }

    const provider = settings.defaultProvider;
    if (!provider || !(provider in PROVIDER_MODELS)) return;

    // Written unfiltered: the model catalogue may not have refreshed yet at
    // session start, and pi ignores patterns that match nothing.
    const desired = resolveEnabledModels(
      provider as ProviderKey,
      settings.defaultModel,
    );
    if (sameList(settings.enabledModels, desired)) return;

    settings.enabledModels = desired;
    try {
      writeFileSync(
        SETTINGS_PATH,
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
}

/**
 * Provider-aware single-shot completion for extensions.
 *
 * pi-ai's compat `complete()` dispatches on `model.api` through its own builtin
 * api registry. Custom providers registered via `pi.registerProvider()` (e.g.
 * kiro's "kiro-api") are never added to that registry, so `complete()` throws
 * `No API provider registered for api: <api>` for their models. Routing through
 * the registered provider's `streamSimple` works for both builtin and custom
 * providers.
 */

import {
  type Api,
  type AssistantMessage,
  type Context,
  complete,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export async function completeWithProvider(
  registry: ModelRegistry,
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions,
): Promise<AssistantMessage> {
  const provider = registry.getProvider(model.provider);
  if (provider) {
    return provider.streamSimple(model, context, options).result();
  }
  return complete(model, context, { ...options });
}

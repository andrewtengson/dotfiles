/**
 * Pure logic for /btw: seeding the side session from the main conversation and resolving its
 * model. Free of pi runtime imports so it can be unit tested.
 */

import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

/**
 * Extensions that hold process-wide resources or write global state, and misbehave when loaded a
 * second time: notify drives the terminal progress bar and bell, toggleterm owns a tmux socket named
 * after the pid and kills it on shutdown, pi-intercom registers this process with the session broker,
 * subagent-models rewrites settings.json on model changes. btw is excluded so the side session cannot
 * open another side session.
 */
const EXCLUDED_EXTENSIONS = [
  /\/extensions\/btw\.ts$/,
  /\/extensions\/notify\.ts$/,
  /\/extensions\/toggleterm\.ts$/,
  /\/extensions\/subagent-models\.ts$/,
  /\/pi-intercom\//,
];

export function isExcludedExtension(path: string): boolean {
  return EXCLUDED_EXTENSIONS.some((pattern) => pattern.test(path));
}

function failed(message: AssistantMessage): boolean {
  return message.stopReason === "error" || message.stopReason === "aborted";
}

/**
 * Main conversation as the side session's starting history. System messages are dropped because the
 * side session builds its own prompt and tool declarations. Failed responses are dropped. Tool calls
 * still running in the main session have no result yet; they are dropped so every call is paired,
 * which providers require.
 */
export function seedMessages(messages: readonly Message[]): Message[] {
  const resultIds = new Set(
    messages.flatMap((m) => (m.role === "toolResult" ? [m.toolCallId] : [])),
  );
  const callIds = new Set<string>();
  const out: Message[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "toolResult") {
      if (callIds.has(message.toolCallId)) out.push(message);
      continue;
    }
    if (message.role === "user") {
      out.push(message);
      continue;
    }
    if (failed(message)) continue;
    const content = message.content.filter(
      (block) => block.type !== "toolCall" || resultIds.has(block.id),
    );
    for (const block of content)
      if (block.type === "toolCall") callIds.add(block.id);
    if (content.length === 0) continue;
    out.push(
      content.length === message.content.length
        ? message
        : { ...message, content },
    );
  }
  return out;
}

interface ModelLike {
  provider: string;
  id: string;
  api: string;
}

export interface BtwTarget<M extends ModelLike> {
  model: M;
  thinkingLevel: string;
}

/**
 * Model for the side session. A virtual selection (e.g. kiro/router) resolves to the physical model
 * and thinking level of the latest successful response, so /btw answers with the model the user has
 * been talking to. Before any response the virtual model is kept and the side session, which loads
 * the router extension, routes it.
 */
export function resolveBtwTarget<M extends ModelLike>(
  selected: M,
  selectedThinking: string,
  mainMessages: readonly Message[],
  find: (provider: string, modelId: string) => M | undefined,
): BtwTarget<M> {
  if (selected.api !== "pi-virtual")
    return { model: selected, thinkingLevel: selectedThinking };
  for (let i = mainMessages.length - 1; i >= 0; i--) {
    const message = mainMessages[i];
    if (
      message?.role !== "assistant" ||
      failed(message) ||
      message.api === "pi-virtual"
    )
      continue;
    const model = find(message.provider, message.model);
    if (model)
      return {
        model,
        thinkingLevel: message.thinkingLevel ?? selectedThinking,
      };
  }
  return { model: selected, thinkingLevel: selectedThinking };
}

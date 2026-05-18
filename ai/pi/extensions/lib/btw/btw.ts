/**
 * Patched @juicesharp/rpiv-btw — /btw side-question slash command.
 *
 * PATCH: strips toolUse/toolResult blocks from cloned conversation before
 * sending to the model. Fixes Bedrock validation error:
 *   "The toolConfig field must be defined when using toolUse and toolResult content blocks"
 *
 * Original: https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-btw
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AssistantMessage,
  completeSimple,
  type Message,
  type StopReason,
  type UserMessage,
} from "@earendil-works/pi-ai";
import {
  convertToLlm,
  type ExtensionAPI,
  type ExtensionContext,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { stripToolMessages } from "./strip-tools.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BTW_COMMAND_NAME = "btw";
export const BTW_STATE_KEY = Symbol.for("rpiv-btw");
export const CROSS_SESSION_HINT_LIMIT = 10;

const _MSG_REQUIRES_INTERACTIVE = "/btw requires interactive mode";
const _MSG_USAGE = "Usage: /btw <question>";
const MSG_NO_MODEL = "/btw requires an active model";
const ERR_EMPTY_RESPONSE = "/btw returned no text content.";

const errMisconfigured = (label: string, err: string) =>
  `/btw model (${label}) is misconfigured: ${err}`;
const errNoApiKey = (label: string) =>
  `/btw model (${label}) has no API key available.`;
const errCallFailed = (err: string | undefined) =>
  `/btw call failed: ${err ?? "unknown error"}`;
const errCallThrew = (msg: string) => `/btw call threw: ${msg}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BtwTurn {
  userMessage: UserMessage;
  assistantMessage: AssistantMessage;
}

export interface BtwState {
  histories: Map<string, BtwTurn[]>;
  snapshots: Map<string, { messages: Message[] }>;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prompt file lives at extensions/prompts/btw-system.txt (two levels up from lib/btw/)
export const BTW_SYSTEM_PROMPT = readFileSync(
  join(__dirname, "..", "..", "prompts", "btw-system.txt"),
  "utf-8",
).trimEnd();

// ---------------------------------------------------------------------------
// Storage — globalThis-keyed, process-scoped
// ---------------------------------------------------------------------------

function getState(): BtwState {
  const g = globalThis as unknown as { [k: symbol]: BtwState | undefined };
  let state = g[BTW_STATE_KEY];
  if (!state) {
    state = { histories: new Map(), snapshots: new Map() };
    g[BTW_STATE_KEY] = state;
  }
  return state;
}

function getSessionFile(ctx: ExtensionContext): string {
  return (
    ctx.sessionManager.getSessionFile() ??
    `memory:${ctx.sessionManager.getSessionId()}`
  );
}

function getSessionHistory(ctx: ExtensionContext): BtwTurn[] {
  const key = getSessionFile(ctx);
  const state = getState();
  let turns = state.histories.get(key);
  if (!turns) {
    turns = [];
    state.histories.set(key, turns);
  }
  return turns;
}

function _pushSessionTurn(ctx: ExtensionContext, turn: BtwTurn): void {
  getSessionHistory(ctx).push(turn);
}

export function clearSessionHistory(ctx: ExtensionContext): void {
  getState().histories.set(getSessionFile(ctx), []);
}

function getSnapshot(
  ctx: ExtensionContext,
): { messages: Message[] } | undefined {
  return getState().snapshots.get(getSessionFile(ctx));
}

function setSnapshot(
  ctx: ExtensionContext,
  snapshot: { messages: Message[] },
): void {
  getState().snapshots.set(getSessionFile(ctx), snapshot);
}

export function invalidateSnapshot(ctx: ExtensionContext): void {
  getState().snapshots.delete(getSessionFile(ctx));
}

export function userMessageText(msg: UserMessage): string {
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export function assistantMessageText(msg: AssistantMessage): string {
  return msg.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

function getCrossSessionHint(): string {
  const allTurns: { q: string; ts: number }[] = [];
  for (const turns of getState().histories.values()) {
    for (const t of turns) {
      allTurns.push({
        q: userMessageText(t.userMessage),
        ts: t.userMessage.timestamp,
      });
    }
  }
  if (allTurns.length === 0) return "";
  const recent = allTurns
    .sort((a, b) => a.ts - b.ts)
    .slice(-CROSS_SESSION_HINT_LIMIT);
  const lines = recent.map(
    (t, i) => `${i + 1}. ${t.q.replace(/\s+/g, " ").slice(0, 200)}`,
  );
  return `\n\n## Recent /btw questions across sessions (oldest first)\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export interface BtwExecResult {
  ok: boolean;
  answer?: string;
  userMessage?: UserMessage;
  assistantMessage?: AssistantMessage;
  error?: string;
  stopReason?: StopReason;
  aborted?: boolean;
}

function readBranchMessages(ctx: ExtensionContext): Message[] {
  const cached = getSnapshot(ctx);
  if (cached) return cached.messages;
  const branch = ctx.sessionManager.getBranch() as SessionEntry[];
  const agentMessages = branch
    .filter(
      (e): e is SessionEntry & { type: "message" } => e.type === "message",
    )
    .map((e) => e.message);
  return convertToLlm(agentMessages);
}

function buildBtwMessages(
  ctx: ExtensionContext,
  userMessage: UserMessage,
): Message[] {
  const branchMessages = readBranchMessages(ctx);
  const history = getSessionHistory(ctx);
  const historyMessages: Message[] = history.flatMap((h) => [
    h.userMessage,
    h.assistantMessage,
  ]);

  // PATCH: strip toolUse/toolResult blocks to avoid Bedrock validation error
  const cleanBranch = stripToolMessages(branchMessages);
  const cleanHistory = stripToolMessages(historyMessages);

  return [...cleanBranch, ...cleanHistory, userMessage];
}

function buildSystemPrompt(): string {
  return BTW_SYSTEM_PROMPT + getCrossSessionHint();
}

export async function executeBtw(
  question: string,
  ctx: ExtensionContext,
  controller: AbortController,
): Promise<BtwExecResult> {
  const model = ctx.model;
  if (!model) {
    return { ok: false, error: MSG_NO_MODEL };
  }
  const modelLabel = `${model.provider}:${model.id}`;

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) {
    return { ok: false, error: errMisconfigured(modelLabel, auth.error) };
  }
  if (!auth.apiKey) {
    return { ok: false, error: errNoApiKey(modelLabel) };
  }

  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: question }],
    timestamp: Date.now(),
  };
  const messages = buildBtwMessages(ctx, userMessage);
  const systemPrompt = buildSystemPrompt();

  try {
    const response = await completeSimple(
      model,
      { systemPrompt, messages, tools: [] },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        signal: controller.signal,
      },
    );

    if (response.stopReason === "aborted") {
      return { ok: false, aborted: true, stopReason: response.stopReason };
    }
    if (response.stopReason === "error") {
      return {
        ok: false,
        error: errCallFailed(response.errorMessage),
        stopReason: response.stopReason,
      };
    }

    const answerText = assistantMessageText(response).trim();
    if (!answerText) {
      return {
        ok: false,
        error: ERR_EMPTY_RESPONSE,
        stopReason: response.stopReason,
      };
    }

    return {
      ok: true,
      answer: answerText,
      userMessage,
      assistantMessage: response,
      stopReason: response.stopReason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (controller.signal.aborted) {
      return { ok: false, aborted: true };
    }
    return { ok: false, error: errCallThrew(message) };
  }
}

// ---------------------------------------------------------------------------
// Registrars
// ---------------------------------------------------------------------------

export function registerMessageEndSnapshot(pi: ExtensionAPI): void {
  pi.on("message_end", async (event, ctx) => {
    const msg = event.message;
    if (msg.role !== "assistant") return;
    if ((msg as AssistantMessage).stopReason === "toolUse") return;
    const branch = ctx.sessionManager.getBranch() as SessionEntry[];
    const agentMessages = branch
      .filter(
        (e): e is SessionEntry & { type: "message" } => e.type === "message",
      )
      .map((e) => e.message);
    setSnapshot(ctx, { messages: convertToLlm(agentMessages) });
  });
}

export function registerInvalidationHooks(pi: ExtensionAPI): void {
  pi.on("session_compact", async (_e, ctx) => invalidateSnapshot(ctx));
  pi.on("session_tree", async (_e, ctx) => invalidateSnapshot(ctx));
}

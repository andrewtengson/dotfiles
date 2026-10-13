/**
 * /btw side session: a full pi session (extensions, codemode, tool search, MCP, skills, AGENTS.md)
 * seeded with the main conversation and kept in memory. It never writes to the main session.
 *
 * A side session is created lazily per main session and reused for follow-ups. Changing the main
 * session's model, or clearing, disposes it; the next question starts a fresh one seeded from the
 * main conversation at that point.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Api, Message, Model } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  buildSessionContext,
  convertToLlm,
  createAgentSession,
  createCodemodeExtension,
  createMcpExtension,
  createToolSearchExtension,
  DefaultResourceLoader,
  type ExtensionContext,
  getAgentDir,
  type LoadExtensionsResult,
  ModelRuntime,
  type SessionEntry,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  isExcludedExtension,
  resolveBtwTarget,
  seedMessages,
} from "./context.js";

const BTW_STATE_KEY = Symbol.for("dotfiles-btw");
const SHUTDOWN_TIMEOUT_MS = 2_000;

const BTW_PROMPT = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "prompts",
    "btw-system.txt",
  ),
  "utf-8",
).trimEnd();

type ThinkingLevel = Parameters<AgentSession["setThinkingLevel"]>[0];

interface SideSession {
  session: AgentSession;
  /** Label of the model the session was created with. */
  modelLabel: string;
  /** Number of main-conversation messages the session was seeded with. */
  seedCount: number;
}

interface BtwState {
  /** Side sessions by main-session key. */
  sessions: Map<string, Promise<SideSession>>;
}

/** globalThis-keyed so side sessions survive /reload, which re-imports this module. */
function state(): BtwState {
  const g = globalThis as unknown as Record<symbol, BtwState | undefined>;
  let s = g[BTW_STATE_KEY];
  if (!s) {
    s = { sessions: new Map() };
    g[BTW_STATE_KEY] = s;
  }
  return s;
}

export function sessionKey(ctx: ExtensionContext): string {
  return (
    ctx.sessionManager.getSessionFile() ??
    `memory:${ctx.sessionManager.getSessionId()}`
  );
}

function mainMessages(ctx: ExtensionContext): Message[] {
  const branch = ctx.sessionManager.getBranch() as SessionEntry[];
  return convertToLlm(buildSessionContext(branch).messages);
}

/** Drop process-scoped extensions; see isExcludedExtension. */
function withoutExcluded(result: LoadExtensionsResult): LoadExtensionsResult {
  return {
    ...result,
    extensions: result.extensions.filter(
      (ext) => !isExcludedExtension(ext.resolvedPath || ext.path),
    ),
  };
}

function modelLabel(model: Model<Api>, thinkingLevel: string): string {
  const level = thinkingLevel === "off" ? "" : ` · ${thinkingLevel}`;
  return `${model.provider}/${model.id}${level}`;
}

async function createSideSession(ctx: ExtensionContext): Promise<SideSession> {
  const selected = ctx.model;
  if (!selected) throw new Error("/btw requires an active model");

  const main = mainMessages(ctx);
  const cwd = ctx.cwd;
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir, {
    projectTrusted: ctx.isProjectTrusted(),
  });

  // SDK sessions do not get the CLI's built-in extensions; add them the way pi's main() does.
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    extensionFactories: [
      {
        name: "codemode",
        factory: createCodemodeExtension(),
        replaceable: true,
        builtin: true,
      },
      {
        name: "tool-search",
        factory: createToolSearchExtension(),
        replaceable: true,
        builtin: true,
      },
      {
        name: "mcp",
        factory: createMcpExtension(),
        replaceable: true,
        builtin: true,
      },
    ],
    extensionsOverride: withoutExcluded,
    appendSystemPromptOverride: (base) => [...base, BTW_PROMPT],
  });
  // The extension loader caches modules by path. Marking the loader as loaded makes reload() clear
  // that cache, so the side session gets its own extension instances instead of sharing the main
  // session's module state.
  (loader as unknown as { loaded: boolean }).loaded = true;
  await loader.reload();

  const modelRuntime = await ModelRuntime.create({ allowModelNetwork: false });
  const target = resolveBtwTarget<Model<Api>>(
    selected,
    ctx.thinkingLevel ?? "off",
    main,
    (provider, id) => ctx.modelRegistry.find(provider, id),
  );

  const sessionManager = SessionManager.inMemory(cwd);
  const seed = seedMessages(main);
  for (const message of seed) sessionManager.appendMessage(message);

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime,
    resourceLoader: loader,
    sessionManager,
    settingsManager,
    sessionStartEvent: { type: "session_start", reason: "startup" },
  });
  await session.bindExtensions({
    mode: "print",
    onError: (error) =>
      console.warn(
        `[btw] ${error.extensionPath} ${error.event}: ${error.error}`,
      ),
  });

  // Extensions register providers and virtual models while binding, so the target model only
  // resolves in the side runtime now.
  const sideModel = modelRuntime.getModel(
    target.model.provider,
    target.model.id,
  );
  if (!sideModel) {
    await disposeSession(session);
    throw new Error(
      `/btw: ${target.model.provider}/${target.model.id} is not available in the side session`,
    );
  }
  await session.setModel(sideModel);
  session.setThinkingLevel(target.thinkingLevel as ThinkingLevel);

  // Count raw session messages: the overlay slices session.messages, not the LLM view.
  const seedCount = session.messages.length;
  return {
    session,
    modelLabel: modelLabel(sideModel, target.thinkingLevel),
    seedCount,
  };
}

async function disposeSession(session: AgentSession): Promise<void> {
  try {
    await session.abort();
    const runner = session.extensionRunner;
    if (runner.hasHandlers("session_shutdown")) {
      await Promise.race([
        runner.emit({ type: "session_shutdown", reason: "quit" }),
        new Promise((resolve) =>
          setTimeout(resolve, SHUTDOWN_TIMEOUT_MS).unref(),
        ),
      ]);
    }
  } catch (error) {
    console.warn(
      `[btw] side session shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    session.dispose();
  }
}

export type { SideSession };

/** Side session for the current main session, created on first use. */
export function getSideSession(ctx: ExtensionContext): Promise<SideSession> {
  const key = sessionKey(ctx);
  const sessions = state().sessions;
  let pending = sessions.get(key);
  if (!pending) {
    pending = createSideSession(ctx);
    sessions.set(key, pending);
    // A failed creation must not stick; the next question retries.
    pending.catch(() => {
      if (sessions.get(key) === pending) sessions.delete(key);
    });
  }
  return pending;
}

/** The side session if one exists and has finished starting. */
export async function existingSideSession(
  ctx: ExtensionContext,
): Promise<SideSession | undefined> {
  const pending = state().sessions.get(sessionKey(ctx));
  if (!pending) return undefined;
  try {
    return await pending;
  } catch {
    return undefined;
  }
}

/** Dispose the side session for a main session; the next question starts a fresh one. */
export async function resetSideSession(key: string): Promise<void> {
  const sessions = state().sessions;
  const pending = sessions.get(key);
  if (!pending) return;
  sessions.delete(key);
  try {
    await disposeSession((await pending).session);
  } catch {
    // Creation failed; nothing to dispose.
  }
}

export async function resetAllSideSessions(): Promise<void> {
  await Promise.all([...state().sessions.keys()].map(resetSideSession));
}

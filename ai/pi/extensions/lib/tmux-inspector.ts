/**
 * tmux inspector provider for pi-subagents Fleet.
 *
 * Opens the pi-subagents inspector runner in a tmux split next to the Pi pane,
 * tags the pane with a user option, and records a binding under the run's
 * async dir so status/close can verify ownership before touching the pane.
 */

import { execFile } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// Structural copies of pi-subagents/inspectors types; avoids a runtime/module
// dependency on the package's install location.
export interface InspectorTarget {
  runId: string;
  asyncDir: string;
  index?: number;
  status: { cwd?: string; state: string; steps?: unknown[] };
}

export interface InspectorContext {
  cwd: string;
  signal?: AbortSignal;
  env: NodeJS.ProcessEnv;
  target: InspectorTarget;
}

export interface InspectorLaunch {
  executable: string;
  argv: string[];
  displayCommand: string;
  allowSteer: boolean;
  allowStop: boolean;
  sessionRoots: string[];
}

export interface InspectorParams {
  focus?: boolean;
}

export interface InspectorResult {
  content: { type: "text"; text: string }[];
  details: { mode: "management"; results: [] };
  isError?: true;
}

export interface InspectorPlugin {
  readonly name: string;
  available(context: InspectorContext): boolean;
  owns(context: InspectorContext): boolean;
  open(
    context: InspectorContext,
    launch: InspectorLaunch,
    params: InspectorParams,
  ): Promise<InspectorResult>;
  status(context: InspectorContext): Promise<InspectorResult>;
  close(context: InspectorContext): Promise<InspectorResult>;
}

export type TmuxRunner = (
  args: string[],
  signal?: AbortSignal,
) => Promise<{ stdout: string }>;

interface TmuxBinding {
  schemaVersion: 1;
  kind: "tmux-inspector";
  runId: string;
  childIndex?: number;
  asyncDir: string;
  socket: string;
  paneId: string;
  tag: string;
  openedAt: string;
}

const PANE_TAG_OPTION = "@pi-subagents-inspector";
/** Terminal cells are roughly twice as tall as they are wide. */
const CELL_ASPECT_RATIO = 2;
const TMUX_TIMEOUT_MS = 10_000;

const defaultRunner: TmuxRunner = (args, signal) =>
  new Promise((resolve, reject) => {
    execFile(
      process.env.TMUX_BIN ?? "tmux",
      args,
      {
        signal,
        timeout: TMUX_TIMEOUT_MS,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || error.message;
          reject(new Error(detail));
          return;
        }
        resolve({ stdout });
      },
    );
  });

function result(text: string, isError = false): InspectorResult {
  const response: InspectorResult = {
    content: [{ type: "text", text }],
    details: { mode: "management", results: [] },
  };
  if (isError) response.isError = true;
  return response;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** $TMUX is "<socket>,<pid>,<session>"; socket paths cannot contain commas in practice. */
function tmuxSocket(env: NodeJS.ProcessEnv): string | undefined {
  const socket = env.TMUX?.split(",")[0]?.trim();
  return socket ? socket : undefined;
}

function paneTag(target: InspectorTarget): string {
  return target.index === undefined
    ? target.runId
    : `${target.runId}:${target.index}`;
}

function bindingPath(target: InspectorTarget): string {
  const suffix = target.index === undefined ? "" : `-${target.index}`;
  return join(target.asyncDir, "inspectors", `tmux${suffix}.json`);
}

function isBinding(value: unknown): value is TmuxBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Record<string, unknown>;
  return (
    binding.schemaVersion === 1 &&
    binding.kind === "tmux-inspector" &&
    typeof binding.runId === "string" &&
    typeof binding.asyncDir === "string" &&
    typeof binding.socket === "string" &&
    typeof binding.paneId === "string" &&
    typeof binding.tag === "string" &&
    (binding.childIndex === undefined ||
      (Number.isInteger(binding.childIndex) &&
        (binding.childIndex as number) >= 0))
  );
}

function readBinding(target: InspectorTarget): TmuxBinding | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(bindingPath(target), "utf8"));
  } catch {
    return undefined;
  }
  if (!isBinding(parsed)) return undefined;
  if (parsed.runId !== target.runId || parsed.childIndex !== target.index)
    return undefined;
  try {
    if (realpathSync(parsed.asyncDir) !== realpathSync(target.asyncDir))
      return undefined;
  } catch {
    return undefined;
  }
  return parsed;
}

function writeBinding(target: InspectorTarget, binding: TmuxBinding): void {
  const file = bindingPath(target);
  mkdirSync(join(target.asyncDir, "inspectors"), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(binding, null, 2)}\n`, "utf8");
  renameSync(temp, file);
}

function removeBinding(target: InspectorTarget): void {
  rmSync(bindingPath(target), { force: true });
}

type PaneState =
  | { kind: "live"; tag: string; dead: boolean }
  | { kind: "gone"; reason: string };

async function inspectPane(
  run: TmuxRunner,
  binding: TmuxBinding,
  signal?: AbortSignal,
): Promise<PaneState> {
  try {
    const { stdout } = await run(
      [
        "-S",
        binding.socket,
        "display-message",
        "-p",
        "-t",
        binding.paneId,
        `#{pane_id}\t#{${PANE_TAG_OPTION}}\t#{pane_dead}`,
      ],
      signal,
    );
    const [paneId, tag = "", dead = "0"] = stdout.trim().split("\t");
    if (!paneId) return { kind: "gone", reason: "pane no longer exists" };
    if (paneId !== binding.paneId)
      return { kind: "gone", reason: `tmux resolved ${paneId}` };
    return { kind: "live", tag, dead: dead === "1" };
  } catch (cause) {
    return { kind: "gone", reason: messageOf(cause) };
  }
}

type SplitFlag = "-h" | "-v";

/** Split along the pane's visually longer axis; side by side when size is unknown. */
async function chooseSplit(
  run: TmuxRunner,
  socket: string,
  paneId: string,
  signal?: AbortSignal,
): Promise<SplitFlag> {
  try {
    const { stdout } = await run(
      [
        "-S",
        socket,
        "display-message",
        "-p",
        "-t",
        paneId,
        "#{pane_width} #{pane_height}",
      ],
      signal,
    );
    const [width, height] = stdout.trim().split(" ").map(Number);
    if (!width || !height) return "-h";
    return width >= height * CELL_ASPECT_RATIO ? "-h" : "-v";
  } catch {
    return "-h";
  }
}

export function createTmuxInspectorPlugin(
  deps: { run?: TmuxRunner; now?: () => Date } = {},
): InspectorPlugin {
  const run = deps.run ?? defaultRunner;
  const now = deps.now ?? (() => new Date());

  return {
    name: "tmux",

    available: (context) =>
      tmuxSocket(context.env) !== undefined &&
      Boolean(context.env.TMUX_PANE?.trim()),

    owns: (context) => readBinding(context.target) !== undefined,

    async open(context, launch, params) {
      const socket = tmuxSocket(context.env);
      const sourcePane = context.env.TMUX_PANE?.trim();
      if (!socket || !sourcePane)
        return result("tmux inspector error: not running inside tmux.", true);

      const target = context.target;
      const tag = paneTag(target);
      const cwd = target.status.cwd ?? context.cwd;
      const splitArgs = [
        "-S",
        socket,
        "split-window",
        await chooseSplit(run, socket, sourcePane, context.signal),
        ...(params.focus === true ? [] : ["-d"]),
        "-P",
        "-F",
        "#{pane_id}",
        "-t",
        sourcePane,
        "-c",
        cwd,
        // argv after "--" is exec'd directly by tmux, bypassing the shell.
        "--",
        launch.executable,
        ...launch.argv,
      ];

      let paneId: string;
      try {
        const { stdout } = await run(splitArgs, context.signal);
        paneId = stdout.trim();
      } catch (cause) {
        return result(`tmux inspector error: ${messageOf(cause)}`, true);
      }
      if (!/^%\d+$/.test(paneId))
        return result(
          `tmux inspector error: unexpected pane id '${paneId}' from split-window.`,
          true,
        );

      try {
        await run(
          [
            "-S",
            socket,
            "set-option",
            "-p",
            "-t",
            paneId,
            PANE_TAG_OPTION,
            tag,
          ],
          context.signal,
        );
        writeBinding(target, {
          schemaVersion: 1,
          kind: "tmux-inspector",
          runId: target.runId,
          ...(target.index === undefined ? {} : { childIndex: target.index }),
          asyncDir: target.asyncDir,
          socket,
          paneId,
          tag,
          openedAt: now().toISOString(),
        });
      } catch (cause) {
        return result(
          `Opened tmux pane ${paneId} for async run ${target.runId}, but binding it failed (${messageOf(cause)}); status and close will not find it.`,
          true,
        );
      }
      return result(
        `Opened tmux inspector pane ${paneId} for async run ${target.runId}${target.index === undefined ? "" : ` child ${target.index}`}.`,
      );
    },

    async status(context) {
      const binding = readBinding(context.target);
      if (!binding)
        return result(
          `No tmux inspector binding for async run ${context.target.runId}.`,
          true,
        );
      const pane = await inspectPane(run, binding, context.signal);
      if (pane.kind === "gone") {
        removeBinding(context.target);
        return result(
          `tmux inspector pane ${binding.paneId} is gone (${pane.reason}); binding removed.`,
        );
      }
      if (pane.tag !== binding.tag) {
        removeBinding(context.target);
        return result(
          `tmux pane ${binding.paneId} no longer belongs to this inspector; binding removed.`,
        );
      }
      return result(
        `tmux inspector pane ${binding.paneId} is ${pane.dead ? "dead" : "open"} for async run ${binding.runId} (opened ${binding.openedAt}).`,
      );
    },

    async close(context) {
      const binding = readBinding(context.target);
      if (!binding)
        return result(
          `No tmux inspector binding for async run ${context.target.runId}.`,
          true,
        );
      const pane = await inspectPane(run, binding, context.signal);
      if (pane.kind === "gone") {
        removeBinding(context.target);
        return result(
          `tmux inspector pane ${binding.paneId} was already closed; binding removed.`,
        );
      }
      // tmux reuses pane ids across a server restart; the tag proves ownership.
      if (pane.tag !== binding.tag) {
        removeBinding(context.target);
        return result(
          `Refusing to close tmux pane ${binding.paneId}: it is no longer tagged for this inspector. Binding removed.`,
          true,
        );
      }
      try {
        await run(
          ["-S", binding.socket, "kill-pane", "-t", binding.paneId],
          context.signal,
        );
      } catch (cause) {
        return result(
          `tmux inspector error: failed to close pane ${binding.paneId}: ${messageOf(cause)}`,
          true,
        );
      }
      removeBinding(context.target);
      return result(
        `Closed tmux inspector pane ${binding.paneId}. The subagent run keeps going.`,
      );
    },
  };
}

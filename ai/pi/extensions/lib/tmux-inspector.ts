/**
 * tmux inspector provider for pi-subagents Fleet.
 *
 * Opens the run's transcript (output log) in `less +F` in a tmux split next to
 * the Pi pane. A prefix-table key, active only on inspector panes, toggles the
 * pi-subagents dashboard runner beside it. Panes are tagged with a user option
 * and recorded in a binding under the run's async dir so status/close/toggle
 * verify ownership before touching a pane.
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
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

interface DashboardLaunch {
  executable: string;
  argv: string[];
  cwd: string;
}

interface TmuxBinding {
  schemaVersion: 1;
  kind: "tmux-inspector";
  runId: string;
  childIndex?: number;
  asyncDir: string;
  socket: string;
  /** Transcript pane. */
  paneId: string;
  tag: string;
  openedAt: string;
  /** Absent in bindings written before the dashboard toggle existed. */
  dashboard?: DashboardLaunch;
  dashboardPaneId?: string;
}

const PANE_TAG_OPTION = "@pi-subagents-inspector";
/** Per-pane pointer to the binding file; its presence enables the toggle key. */
const BINDING_OPTION = "@pi-subagents-inspector-binding";
/** Global option remembering what the toggle key did before we took it over. */
const PREV_KEY_OPTION = "@pi-subagents-inspector-prev-key";
const TOGGLE_KEY = "t";
const DASHBOARD_TAG_SUFFIX = "#dashboard";
const UNOWNED_KEY_FALLBACK =
  "display-message 'Not a pi-subagents inspector pane'";
const TOGGLE_SCRIPT = fileURLToPath(
  new URL("./tmux-inspector-toggle.ts", import.meta.url),
);

/**
 * $1 status-prompt hint, $2 follow-prompt hint, $3 log path. The log may not
 * exist until the child writes its first output.
 */
const TRANSCRIPT_SCRIPT = [
  'if [ ! -e "$3" ]; then printf \'Waiting for %s\\n\' "$3"; fi',
  'while [ ! -e "$3" ]; do sleep 0.5; done',
  'exec less -R +F "-Ps$1   ?e(END):%pb\\%.   F follow  q quit" "-Pw$2" "$3"',
].join("\n");

/**
 * Runs the dashboard on the alternate screen: its full-screen redraws then never
 * reach pane scrollback, which otherwise fills with stacked copies of each frame.
 */
const DASHBOARD_SCRIPT =
  "printf '\\033[?1049h'; \"$@\"; code=$?; printf '\\033[?1049l'; exit $code";
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

function isDashboardLaunch(value: unknown): value is DashboardLaunch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const launch = value as Record<string, unknown>;
  return (
    typeof launch.executable === "string" &&
    typeof launch.cwd === "string" &&
    Array.isArray(launch.argv) &&
    launch.argv.every((arg) => typeof arg === "string")
  );
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
    (binding.dashboard === undefined || isDashboardLaunch(binding.dashboard)) &&
    (binding.dashboardPaneId === undefined ||
      typeof binding.dashboardPaneId === "string") &&
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
  writeBindingFile(bindingPath(target), binding);
}

function writeBindingFile(file: string, binding: TmuxBinding): void {
  mkdirSync(dirname(file), { recursive: true });
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

/** Step whose output log the transcript follows; mirrors pi-subagents' own selection. */
function transcriptStepIndex(target: InspectorTarget): number {
  if (target.index !== undefined) return target.index;
  try {
    const status: unknown = JSON.parse(
      readFileSync(join(target.asyncDir, "status.json"), "utf8"),
    );
    const current =
      status && typeof status === "object"
        ? (status as Record<string, unknown>).currentStep
        : undefined;
    if (Number.isInteger(current) && (current as number) >= 0)
      return current as number;
  } catch {
    // Status unreadable: the first step is the only safe default.
  }
  return 0;
}

async function prefixKey(
  run: TmuxRunner,
  socket: string,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const { stdout } = await run(
      ["-S", socket, "show-options", "-gv", "prefix"],
      signal,
    );
    return stdout.trim() || "prefix";
  } catch {
    return "prefix";
  }
}

/**
 * Binds `prefix t` to toggle the dashboard when the active pane is an inspector
 * pane, and to whatever `t` did before everywhere else. The original command is
 * kept in a global option so reinstalling never wraps our own binding.
 */
async function installToggleKey(
  run: TmuxRunner,
  socket: string,
  signal?: AbortSignal,
): Promise<void> {
  const stored = await run(
    ["-S", socket, "show-options", "-gqv", PREV_KEY_OPTION],
    signal,
  ).then(
    ({ stdout }) => stdout.trim(),
    () => "",
  );
  let fallback = stored;
  if (!fallback) {
    const current = await run(
      ["-S", socket, "list-keys", "-T", "prefix", TOGGLE_KEY],
      signal,
    ).then(
      ({ stdout }) => stdout.trim(),
      () => "",
    );
    const match = current.match(
      /^bind-key\s+(?:-r\s+)?-T\s+prefix\s+\S+\s+(.+)$/,
    );
    const command = match?.[1]?.trim() ?? "";
    fallback =
      command && !command.includes(BINDING_OPTION)
        ? command
        : UNOWNED_KEY_FALLBACK;
    await run(
      ["-S", socket, "set-option", "-g", PREV_KEY_OPTION, fallback],
      signal,
    );
  }
  // #{q:...} shell-quotes the binding path tmux expands at key-press time.
  const toggle = `run-shell -b "exec ${shellQuote(process.execPath)} ${shellQuote(TOGGLE_SCRIPT)} #{q:${BINDING_OPTION}}"`;
  await run(
    [
      "-S",
      socket,
      "bind-key",
      "-T",
      "prefix",
      TOGGLE_KEY,
      "if-shell",
      "-F",
      `#{${BINDING_OPTION}}`,
      toggle,
      fallback,
    ],
    signal,
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function tagPane(
  run: TmuxRunner,
  socket: string,
  paneId: string,
  tag: string,
  file: string,
  signal?: AbortSignal,
): Promise<void> {
  for (const [option, value] of [
    [PANE_TAG_OPTION, tag],
    [BINDING_OPTION, file],
  ] as const) {
    await run(
      ["-S", socket, "set-option", "-p", "-t", paneId, option, value],
      signal,
    );
  }
}

function parsePaneId(stdout: string): string {
  const paneId = stdout.trim();
  if (!/^%\d+$/.test(paneId))
    throw new Error(`unexpected pane id '${paneId}' from split-window`);
  return paneId;
}

/** Binding file must sit at <asyncDir>/inspectors/tmux*.json of the run it names. */
function readBindingFile(file: string): TmuxBinding {
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isBinding(parsed)) throw new Error(`invalid inspector binding ${file}`);
  const expected = join(
    realpathSync(parsed.asyncDir),
    "inspectors",
    basename(file),
  );
  if (
    realpathSync(file) !== expected ||
    !/^tmux(-\d+)?\.json$/.test(basename(file))
  )
    throw new Error(`binding ${file} is outside its run directory`);
  return parsed;
}

/**
 * Opens the dashboard beside the transcript pane, or closes it when already
 * open. Invoked by the tmux toggle key with the binding path of the focused pane.
 */
export async function toggleDashboard(
  file: string,
  run: TmuxRunner = defaultRunner,
): Promise<string> {
  const binding = readBindingFile(file);
  if (!binding.dashboard)
    throw new Error(
      "this inspector predates the dashboard toggle; reopen it from Fleet",
    );
  const dashboardTag = `${binding.tag}${DASHBOARD_TAG_SUFFIX}`;

  if (binding.dashboardPaneId) {
    const pane = await inspectPane(run, {
      ...binding,
      paneId: binding.dashboardPaneId,
    });
    const { dashboardPaneId, ...rest } = binding;
    if (pane.kind === "live" && pane.tag === dashboardTag) {
      await run(["-S", binding.socket, "kill-pane", "-t", dashboardPaneId]);
      writeBindingFile(file, rest);
      return `Closed dashboard pane ${dashboardPaneId}.`;
    }
    writeBindingFile(file, rest);
  }

  const transcript = await inspectPane(run, binding);
  if (transcript.kind === "gone" || transcript.tag !== binding.tag)
    throw new Error(`transcript pane ${binding.paneId} is gone`);

  const { stdout } = await run([
    "-S",
    binding.socket,
    "split-window",
    await chooseSplit(run, binding.socket, binding.paneId),
    "-P",
    "-F",
    "#{pane_id}",
    "-t",
    binding.paneId,
    "-c",
    binding.dashboard.cwd,
    "--",
    "sh",
    "-c",
    DASHBOARD_SCRIPT,
    "sh",
    binding.dashboard.executable,
    ...binding.dashboard.argv,
  ]);
  const paneId = parsePaneId(stdout);
  await tagPane(run, binding.socket, paneId, dashboardTag, file);
  writeBindingFile(file, { ...binding, dashboardPaneId: paneId });
  return `Opened dashboard pane ${paneId}.`;
}

/** Kills the dashboard pane only when it still carries this binding's tag. */
async function closeDashboard(
  run: TmuxRunner,
  binding: TmuxBinding,
  signal?: AbortSignal,
): Promise<void> {
  if (!binding.dashboardPaneId) return;
  const pane = await inspectPane(
    run,
    { ...binding, paneId: binding.dashboardPaneId },
    signal,
  );
  if (
    pane.kind === "live" &&
    pane.tag === `${binding.tag}${DASHBOARD_TAG_SUFFIX}`
  )
    await run(
      ["-S", binding.socket, "kill-pane", "-t", binding.dashboardPaneId],
      signal,
    );
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
      const logPath = join(
        target.asyncDir,
        `output-${transcriptStepIndex(target)}.log`,
      );
      const toggleKey = `${await prefixKey(run, socket, context.signal)} ${TOGGLE_KEY}`;
      const keyHint = `[${toggleKey}] dashboard`;
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
        // argv after "--" is exec'd directly by tmux; values reach sh as
        // positional args, never as interpolated script text.
        "--",
        "sh",
        "-c",
        TRANSCRIPT_SCRIPT,
        "sh",
        keyHint,
        `${keyHint}  (following; Ctrl-C to scroll)`,
        logPath,
      ];

      let paneId: string;
      try {
        const { stdout } = await run(splitArgs, context.signal);
        paneId = parsePaneId(stdout);
      } catch (cause) {
        return result(`tmux inspector error: ${messageOf(cause)}`, true);
      }

      try {
        await tagPane(
          run,
          socket,
          paneId,
          tag,
          bindingPath(target),
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
          dashboard: {
            executable: launch.executable,
            argv: launch.argv,
            cwd,
          },
        });
      } catch (cause) {
        return result(
          `Opened tmux pane ${paneId} for async run ${target.runId}, but binding it failed (${messageOf(cause)}); status and close will not find it.`,
          true,
        );
      }
      const opened = `Opened tmux transcript pane ${paneId} for async run ${target.runId}${target.index === undefined ? "" : ` child ${target.index}`}`;
      try {
        await installToggleKey(run, socket, context.signal);
      } catch (cause) {
        return result(
          `${opened}, but installing the ${toggleKey} key failed: ${messageOf(cause)}.`,
        );
      }
      return result(`${opened}; ${toggleKey} toggles the dashboard.`);
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
        await closeDashboard(run, binding, context.signal);
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

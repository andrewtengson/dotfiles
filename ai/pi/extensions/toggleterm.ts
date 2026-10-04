/**
 * toggleterm for pi: Ctrl-\ toggles a persistent floating terminal.
 *
 * Mirrors the nvim toggleterm config (direction = float, single border, open_mapping = <c-\>).
 * The terminal is a tmux session on a private socket, so the shell survives
 * closing the float. Inside tmux it opens as a display-popup; outside tmux the
 * TUI is suspended and the session is attached full screen.
 *
 *   Ctrl-\            toggle the default terminal (inside the terminal: hide it)
 *   /toggleterm       same as Ctrl-\
 *   /toggleterm CMD   toggle a dedicated terminal running CMD (e.g. lazygit, htop)
 */

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const TOGGLE_KEY = "ctrl+\\";
const FLOAT_RATIO = 0.9;
const FLOAT_FALLBACK = "90%";
const MIN_POPUP_WIDTH = 10;
const MIN_POPUP_HEIGHT = 5;
const DEFAULT_TERMINAL = "default";
// Inner tmux binding is a literal backslash; tmux spells it "C-\\".
const TMUX_DETACH_KEY = "C-\\";
const FORWARD_TABLE = "pi-forward";
const FORWARD_OPTION = "@pi_forward_key";

function tmux(
  socket: string,
  args: string[],
  cwd?: string,
): { ok: boolean; stderr: string } {
  const result = spawnSync("tmux", ["-L", socket, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, TMUX: "" },
  });
  return { ok: result.status === 0, stderr: result.stderr ?? "" };
}

function outerTmux(args: string[]): string | undefined {
  const result = spawnSync("tmux", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

interface OuterTmux {
  socket: string;
  client: string;
  prefix: string;
  prefixKeys: string[];
}

// send-keys -K (replaying a key through the client's key tables) needs tmux 3.4.
const FORWARD_MIN_VERSION = [3, 4] as const;

function tmuxVersion(): [number, number] | undefined {
  const raw = outerTmux(["-V"]);
  const match = raw?.match(/(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2])] : undefined;
}

function supportsForwarding(): boolean {
  const version = tmuxVersion();
  if (!version) return false;
  const [major, minor] = version;
  const [minMajor, minMinor] = FORWARD_MIN_VERSION;
  return major > minMajor || (major === minMajor && minor >= minMinor);
}

function outerTmuxInfo(): OuterTmux | undefined {
  const socket = process.env.TMUX?.split(",")[0];
  const pane = process.env.TMUX_PANE;
  if (!socket || !pane) return undefined;
  const prefix = outerTmux(["show-options", "-gv", "prefix"]);
  const client = outerTmux([
    "display-message",
    "-p",
    "-t",
    pane,
    "#{client_name}",
  ]);
  if (!prefix || prefix === "None" || !client) return undefined;
  const keys = outerTmux(["list-keys", "-T", "prefix", "-F", "#{key_string}"]);
  return {
    socket,
    client,
    prefix,
    prefixKeys: keys ? keys.split("\n").filter(Boolean) : [],
  };
}

// tmux parses a bare ";" argument as a command separator; it must be escaped.
function keyArg(key: string): string {
  return key === ";" ? "\\;" : key;
}

/**
 * A popup swallows every key, so the outer prefix can't reach the outer tmux.
 * Inside the float, the prefix switches to a FORWARD_TABLE where each outer prefix
 * key records itself and detaches; pi then replays prefix + key on the outer client.
 * Capturing the key inside the popup means fast typing can't lose it while the
 * popup is closing.
 */
function bindPrefixForwarding(
  socket: string,
  outer: OuterTmux,
  previousPrefix: string | undefined,
): string | undefined {
  // The inner server outlives each open. Rebuild the forward table from scratch so
  // removed or reordered outer bindings can't replay a stale index, and release an
  // old prefix so the shell receives it again. These run as their own invocation:
  // a no-op unbind (table or key absent) silently drops any commands chained after it.
  const unbind: string[] = ["unbind-key", "-aq", "-T", FORWARD_TABLE];
  if (previousPrefix && previousPrefix !== outer.prefix) {
    unbind.push(";", "unbind-key", "-nq", previousPrefix);
  }
  tmux(socket, unbind);

  const argv: string[] = [];
  argv.push(
    "bind-key",
    "-n",
    outer.prefix,
    `set-option -gu ${FORWARD_OPTION} ; switch-client -T ${FORWARD_TABLE}`,
  );
  outer.prefixKeys.forEach((key, index) => {
    argv.push(
      ";",
      "bind-key",
      "-T",
      FORWARD_TABLE,
      keyArg(key),
      `set-option -g ${FORWARD_OPTION} ${index} ; detach-client`,
    );
  });
  // One tmux invocation for ~100 bindings keeps the open path fast.
  const result = tmux(socket, argv);
  return result.ok
    ? undefined
    : `tmux prefix forwarding failed: ${result.stderr.trim()}`;
}

function takeForwardedKey(
  socket: string,
  outer: OuterTmux,
): string | undefined {
  const result = spawnSync(
    "tmux",
    ["-L", socket, "show-options", "-gv", FORWARD_OPTION],
    {
      encoding: "utf8",
      env: { ...process.env, TMUX: "" },
    },
  );
  tmux(socket, ["set-option", "-gu", FORWARD_OPTION]);
  const index = Number(result.stdout?.trim());
  if (result.status !== 0 || !Number.isInteger(index)) return undefined;
  return outer.prefixKeys[index];
}

function replayOnOuter(outer: OuterTmux, key: string): string | undefined {
  const result = spawnSync(
    "tmux",
    [
      "-S",
      outer.socket,
      "switch-client",
      "-c",
      outer.client,
      "-T",
      "prefix",
      ";",
      "send-keys",
      "-c",
      outer.client,
      "-K",
      keyArg(key),
    ],
    { encoding: "utf8" },
  );
  return result.status === 0
    ? undefined
    : `forwarding ${key} failed: ${result.stderr.trim()}`;
}

function sessionName(cmd: string | undefined): string {
  if (!cmd) return DEFAULT_TERMINAL;
  return `cmd-${createHash("sha1").update(cmd).digest("hex").slice(0, 10)}`;
}

function hasSession(socket: string, name: string): boolean {
  return tmux(socket, ["has-session", "-t", name]).ok;
}

/** Exit status of a command terminal whose process has exited, else undefined. */
function deadStatus(socket: string, name: string): number | undefined {
  const result = spawnSync(
    "tmux",
    [
      "-L",
      socket,
      "display-message",
      "-p",
      "-t",
      name,
      "#{pane_dead} #{pane_dead_status}",
    ],
    { encoding: "utf8", env: { ...process.env, TMUX: "" } },
  );
  const [dead, status] = (result.stdout ?? "").trim().split(" ");
  return result.status === 0 && dead === "1" ? Number(status) : undefined;
}

/**
 * A command terminal that has exited is kept (remain-on-exit) only so its status
 * can be reported; drop it so the next /toggleterm CMD starts fresh.
 */
function reapDeadCommand(
  ctx: ExtensionContext,
  socket: string,
  name: string,
  cmd: string | undefined,
): boolean {
  if (!cmd) return false;
  const status = deadStatus(socket, name);
  if (status === undefined) return false;
  tmux(socket, ["kill-session", "-t", name]);
  if (status !== 0) {
    ctx.ui.notify(`toggleterm: "${cmd}" exited with code ${status}`, "error");
  }
  return true;
}

function ensureSession(
  socket: string,
  name: string,
  cwd: string,
  cmd: string | undefined,
): string | undefined {
  if (hasSession(socket, name)) return undefined;

  // Options go in the same invocation as new-session so they are in place before
  // CMD can exit.
  const create = tmux(
    socket,
    [
      "-f",
      "/dev/null",
      "start-server",
      ";",
      // Keep a dead command's pane so its exit status can be reported instead of
      // the session (and server) vanishing mid-open. Global, so it is in place
      // before CMD starts; the default shell opts out below.
      "set-option",
      "-g",
      "remain-on-exit",
      "on",
      ";",
      "new-session",
      "-d",
      "-s",
      name,
      "-c",
      cwd,
      ...(cmd ? [cmd] : []),
      ";",
      "set-option",
      "-g",
      "status",
      "off",
      ";",
      "set-option",
      "-g",
      "escape-time",
      "0",
      ";",
      "set-option",
      "-g",
      "mouse",
      "on",
      ";",
      "set-option",
      "-g",
      "history-limit",
      "50000",
      ";",
      "bind-key",
      "-n",
      TMUX_DETACH_KEY,
      "detach-client",
      // Typing `exit` in the default shell should end it, not leave a dead pane.
      ...(cmd
        ? []
        : [";", "set-option", "-w", "-t", name, "remain-on-exit", "off"]),
    ],
    cwd,
  );
  return create.ok
    ? undefined
    : `tmux new-session failed: ${create.stderr.trim()}`;
}

function attachArgs(socket: string, name: string): string[] {
  return [
    "env",
    "-u",
    "TMUX",
    "tmux",
    "-L",
    socket,
    "attach-session",
    "-t",
    name,
  ];
}

interface PopupGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * tmux resolves popup percentages against the whole client, so a pane in a split
 * window gets a popup bigger than itself. Compute absolute cells from the pane rect.
 */
function paneGeometry(): PopupGeometry | undefined {
  const pane = process.env.TMUX_PANE;
  if (!pane) return undefined;
  const raw = outerTmux([
    "display-message",
    "-p",
    "-t",
    pane,
    "#{pane_left} #{pane_top} #{pane_width} #{pane_height} #{status} #{status-position}",
  ]);
  if (!raw) return undefined;
  const [left, top, width, height, status, statusPosition] = raw.split(" ");
  const [l, t, w, h] = [left, top, width, height].map(Number);
  if ([l, t, w, h].some((n) => !Number.isInteger(n))) return undefined;
  // A popup larger than the pane would be positioned out of bounds, which tmux
  // silently refuses; let tmux size it against the client instead.
  if (w < MIN_POPUP_WIDTH || h < MIN_POPUP_HEIGHT) return undefined;

  const statusLines =
    status === "on" ? 1 : status === "off" ? 0 : Number(status) || 0;
  const topOffset = statusPosition === "top" ? statusLines : 0;
  const popupWidth = Math.max(MIN_POPUP_WIDTH, Math.floor(w * FLOAT_RATIO));
  const popupHeight = Math.max(MIN_POPUP_HEIGHT, Math.floor(h * FLOAT_RATIO));
  const popupTop = t + topOffset + Math.floor((h - popupHeight) / 2);
  return {
    x: l + Math.floor((w - popupWidth) / 2),
    // tmux display-popup -y is the row below the popup's bottom edge, not its top.
    y: popupTop + popupHeight,
    width: popupWidth,
    height: popupHeight,
  };
}

function popupSizeArgs(): string[] {
  const geometry = paneGeometry();
  if (!geometry) return ["-w", FLOAT_FALLBACK, "-h", FLOAT_FALLBACK];
  const { x, y, width, height } = geometry;
  return [
    "-x",
    String(x),
    "-y",
    String(y),
    "-w",
    String(width),
    "-h",
    String(height),
  ];
}

interface AttachResult {
  code: number | null;
  stderr: string;
}

function openPopup(
  socket: string,
  name: string,
  cwd: string,
): Promise<AttachResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "tmux",
      [
        "display-popup",
        "-E",
        ...popupSizeArgs(),
        "-b",
        "single",
        "-d",
        cwd,
        "--",
        ...attachArgs(socket, name),
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });
}

async function openFullscreen(
  ctx: ExtensionContext,
  socket: string,
  name: string,
): Promise<AttachResult> {
  return ctx.ui.custom<AttachResult>(async (tui, _theme, _kb, done) => {
    // The shortcut fires on key press. Drain the in-flight Kitty release event
    // (e.g. "\x1b[92;5:3u") so it doesn't leak into the attached shell, the same
    // way pi drains input before exiting.
    await tui.terminal.drainInput(500, 30);
    tui.stop();
    process.stdout.write("\x1b[2J\x1b[H");
    const [bin, ...args] = attachArgs(socket, name);
    const result = spawnSync(bin, args, { stdio: "inherit", env: process.env });
    tui.start();
    tui.requestRender(true);
    done({ code: result.status, stderr: result.error?.message ?? "" });
    return { render: () => [], invalidate: () => {} };
  });
}

// Exit code 0 covers both hiding with Ctrl-\ (detach) and a clean shell exit.
// Non-zero means tmux itself failed (bad popup args, failed attach).
function reportAttach(ctx: ExtensionContext, result: AttachResult): void {
  if (result.code === 0) return;
  const detail = result.stderr.trim() || `exited with code ${result.code}`;
  ctx.ui.notify(`toggleterm: ${detail}`, "error");
}

export default function (pi: ExtensionAPI) {
  const socket = `pi-toggleterm-${process.pid}`;
  let isOpen = false;
  let boundPrefix: string | undefined;

  async function toggle(
    ctx: ExtensionContext,
    cmd: string | undefined,
  ): Promise<void> {
    if (ctx.mode !== "tui") return;
    if (isOpen) return;
    if (spawnSync("tmux", ["-V"], { stdio: "ignore" }).status !== 0) {
      ctx.ui.notify("toggleterm: tmux not found in PATH", "error");
      return;
    }

    const name = sessionName(cmd);
    const failure = ensureSession(socket, name, ctx.cwd, cmd);
    if (failure) {
      ctx.ui.notify(`toggleterm: ${failure}`, "error");
      return;
    }

    const outer =
      process.env.TMUX && supportsForwarding() ? outerTmuxInfo() : undefined;
    if (outer) {
      const forwardFailure = bindPrefixForwarding(socket, outer, boundPrefix);
      if (forwardFailure) {
        ctx.ui.notify(`toggleterm: ${forwardFailure}`, "warning");
      } else {
        boundPrefix = outer.prefix;
      }
    }

    isOpen = true;
    try {
      if (process.env.TMUX) {
        const result = await openPopup(socket, name, ctx.cwd);
        if (!reapDeadCommand(ctx, socket, name, cmd)) reportAttach(ctx, result);
        const key = outer ? takeForwardedKey(socket, outer) : undefined;
        const replayFailure =
          outer && key ? replayOnOuter(outer, key) : undefined;
        if (replayFailure)
          ctx.ui.notify(`toggleterm: ${replayFailure}`, "warning");
      } else {
        const result = await openFullscreen(ctx, socket, name);
        if (!reapDeadCommand(ctx, socket, name, cmd)) reportAttach(ctx, result);
      }
    } catch (error) {
      ctx.ui.notify(
        `toggleterm: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      isOpen = false;
    }
  }

  pi.registerShortcut(TOGGLE_KEY, {
    description: "Toggle floating terminal",
    handler: (ctx) => toggle(ctx, undefined),
  });

  pi.registerCommand("toggleterm", {
    description:
      "Toggle floating terminal, optionally running a command (e.g. /toggleterm lazygit)",
    handler: (args, ctx) => toggle(ctx, args?.trim() || undefined),
  });

  pi.on("session_shutdown", () => {
    tmux(socket, ["kill-server"]);
  });
}

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
): string | undefined {
  const argv: string[] = [
    "bind-key",
    "-n",
    outer.prefix,
    `set-option -gu ${FORWARD_OPTION} ; switch-client -T ${FORWARD_TABLE}`,
  ];
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

function ensureSession(
  socket: string,
  name: string,
  cwd: string,
  cmd: string | undefined,
): string | undefined {
  if (tmux(socket, ["has-session", "-t", name]).ok) return undefined;

  const create = tmux(
    socket,
    [
      "-f",
      "/dev/null",
      "new-session",
      "-d",
      "-s",
      name,
      "-c",
      cwd,
      ...(cmd ? [cmd] : []),
    ],
    cwd,
  );
  if (!create.ok) return `tmux new-session failed: ${create.stderr.trim()}`;

  // Server-wide options are idempotent; apply after the server exists.
  const options: string[][] = [
    ["set-option", "-g", "status", "off"],
    ["set-option", "-g", "escape-time", "0"],
    ["set-option", "-g", "mouse", "on"],
    ["set-option", "-g", "history-limit", "50000"],
    ["bind-key", "-n", TMUX_DETACH_KEY, "detach-client"],
  ];
  for (const option of options) {
    const result = tmux(socket, option);
    if (!result.ok) return `tmux ${option[0]} failed: ${result.stderr.trim()}`;
  }
  return undefined;
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

  const statusLines =
    status === "on" ? 1 : status === "off" ? 0 : Number(status) || 0;
  const topOffset = statusPosition === "top" ? statusLines : 0;
  const popupWidth = Math.max(10, Math.floor(w * FLOAT_RATIO));
  const popupHeight = Math.max(5, Math.floor(h * FLOAT_RATIO));
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

function openPopup(
  socket: string,
  name: string,
  cwd: string,
): Promise<number | null> {
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
      { stdio: "ignore" },
    );
    child.once("error", reject);
    child.once("close", resolve);
  });
}

async function openFullscreen(
  ctx: ExtensionContext,
  socket: string,
  name: string,
): Promise<number | null> {
  return ctx.ui.custom<number | null>(async (tui, _theme, _kb, done) => {
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
    done(result.status);
    return { render: () => [], invalidate: () => {} };
  });
}

export default function (pi: ExtensionAPI) {
  const socket = `pi-toggleterm-${process.pid}`;
  let isOpen = false;

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

    const outer = process.env.TMUX ? outerTmuxInfo() : undefined;
    if (outer) {
      const forwardFailure = bindPrefixForwarding(socket, outer);
      if (forwardFailure)
        ctx.ui.notify(`toggleterm: ${forwardFailure}`, "warning");
    }

    isOpen = true;
    try {
      if (process.env.TMUX) {
        await openPopup(socket, name, ctx.cwd);
        const key = outer ? takeForwardedKey(socket, outer) : undefined;
        const replayFailure =
          outer && key ? replayOnOuter(outer, key) : undefined;
        if (replayFailure)
          ctx.ui.notify(`toggleterm: ${replayFailure}`, "warning");
      } else {
        await openFullscreen(ctx, socket, name);
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

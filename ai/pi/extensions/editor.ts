/**
 * Minimal design: no box borders, subtle separator line,
 * status below with model/thinking + git/context/cost.
 */

import {
  CustomEditor,
  type ExtensionAPI,
  type ExtensionContext,
  type ThemeColor,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { relative } from "node:path";
import {
  BUILTIN_COMMANDS,
  CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteResult,
} from "./lib/command-palette.js";

const MIN_BODY_LINES = 2;
const GIT_CACHE_MS = 3000;
const RESET = "\x1b[0m";

type GitInfo = {
  branch: string | null;
  changedFiles: number;
  added: number;
  removed: number;
};

let gitCache: { cwd: string; at: number; info: GitInfo } | undefined;

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 500,
    }).trim();
  } catch {
    return "";
  }
}

function getGitInfo(cwd: string): GitInfo {
  const now = Date.now();
  if (gitCache && gitCache.cwd === cwd && now - gitCache.at < GIT_CACHE_MS)
    return gitCache.info;

  const branch = runGit(cwd, ["branch", "--show-current"]) || null;
  const porcelain = runGit(cwd, ["status", "--short"]);
  const changedFiles = porcelain
    ? porcelain.split("\n").filter(Boolean).length
    : 0;
  const numstat = runGit(cwd, ["diff", "--numstat"]);
  let added = 0;
  let removed = 0;
  for (const line of numstat.split("\n")) {
    const [a, r] = line.split("\t");
    const add = Number(a);
    const rem = Number(r);
    if (Number.isFinite(add)) added += add;
    if (Number.isFinite(rem)) removed += rem;
  }

  const info = { branch, changedFiles, added, removed };
  gitCache = { cwd, at: now, info };
  return info;
}

function formatCount(value: number | null | undefined): string {
  if (value == null) return "?";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(2)}`;
}

function compactPath(cwd: string): string {
  const home = homedir();
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~/${relative(home, cwd)}`;
  return cwd;
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function isEditorRule(line: string): boolean {
  const plain = stripAnsi(line).trim();
  return (
    plain.includes("─") &&
    [...plain].every((char) => "─↑↓ 0123456789more".includes(char))
  );
}

function splitEditorRender(lines: string[]): {
  editorLines: string[];
  popupLines: string[];
} {
  const withoutTop = lines.slice(1);
  const bottomRuleIndex = withoutTop.findIndex(isEditorRule);

  if (bottomRuleIndex === -1) {
    return { editorLines: withoutTop, popupLines: [] };
  }

  return {
    editorLines: withoutTop.slice(0, bottomRuleIndex),
    popupLines: withoutTop.slice(bottomRuleIndex + 1),
  };
}

function getSessionCost(ctx: ExtensionContext): number {
  let total = 0;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "message" || entry.message.role !== "assistant")
      continue;
    const cost = entry.message.usage?.cost?.total;
    if (typeof cost === "number" && Number.isFinite(cost)) total += cost;
  }
  return total;
}

class FlatEditor extends CustomEditor {
  private editorBg = "";

  constructor(
    tui: any,
    theme: any,
    keybindings: any,
    private readonly getCtx: () => ExtensionContext,
    private readonly getThinkingLevel: () => string,
  ) {
    super(tui, theme, keybindings, { paddingX: 1 });
  }

  private get ctx(): ExtensionContext {
    return this.getCtx();
  }

  private getBg(): string {
    if (!this.editorBg) {
      this.editorBg = this.ctx.ui.theme.getBgAnsi("toolPendingBg");
    }
    return this.editorBg;
  }

  render(width: number): string[] {
    if (width < 12) return super.render(width);

    const innerWidth = Math.max(1, width - 2);
    const base = super.render(innerWidth);
    const { editorLines, popupLines } = splitEditorRender(base);
    const body = [...editorLines];

    while (body.length < MIN_BODY_LINES) {
      body.push(" ".repeat(innerWidth));
    }

    const statusLine = this.buildStatusLine(width);
    const bg = this.getBg();
    const emptyLine = `${bg}${" ".repeat(width)}${RESET}`;

    return [
      emptyLine,
      ...body.map((line) => this.wrapBody(line, innerWidth)),
      `${bg}${statusLine}${" ".repeat(Math.max(0, width - visibleWidth(statusLine)))}${RESET}`,
      ...popupLines,
    ];
  }

  private buildStatusLine(width: number): string {
    const left = this.buildLeftStatus();
    const right = this.buildRightStatus();

    const leftWidth = visibleWidth(left);
    const rightWidth = visibleWidth(right);
    const gap = Math.max(1, width - leftWidth - rightWidth);

    return `${left}${" ".repeat(gap)}${right}`;
  }

  private buildLeftStatus(): string {
    const routerState = (globalThis as any)[Symbol.for("model-router-state")];
    const thinkingLevel = this.getThinkingLevel();
    const thinkingColor = this.getThinkingColor();
    const modelId = this.ctx.model?.id ?? "unknown";
    const provider = String(this.ctx.model?.provider ?? "");

    const parts: string[] = [];

    if (routerState?.autoRoutingEnabled) {
      const label =
        routerState.routed && routerState.lastTier
          ? (routerState.lastTier as string)
          : "auto";
      const color: ThemeColor =
        routerState.lastTier === "heavy" ? "warning" : "accent";
      parts.push(this.fg(color, label));
    }

    parts.push(this.fg(thinkingColor, thinkingLevel));
    parts.push(this.fg("muted", modelId));
    if (provider) parts.push(this.fg("muted", provider));

    return parts.join(this.fg("dim", " · "));
  }

  private buildRightStatus(): string {
    const parts: string[] = [];

    parts.push(this.fg("muted", compactPath(this.ctx.cwd)));

    const git = getGitInfo(this.ctx.cwd);
    if (git.branch) {
      let branchLabel = git.branch;
      if (git.added > 0)
        branchLabel += ` ${this.fg("toolDiffAdded", `+${git.added}`)}`;
      if (git.removed > 0)
        branchLabel += ` ${this.fg("toolDiffRemoved", `-${git.removed}`)}`;
      parts.push(this.fg("muted", branchLabel));
    }

    const usage = this.ctx.getContextUsage();
    if (usage) {
      const tokens = formatCount(usage.tokens);
      const pct =
        usage.percent != null ? `(${Math.floor(usage.percent)}%)` : "";
      parts.push(this.fg("muted", `${tokens} ${pct}`));
    }

    const cost = getSessionCost(this.ctx);
    if (cost > 0) {
      parts.push(this.fg("muted", formatCost(cost)));
    }

    const result = parts.join(this.fg("dim", " · "));
    return result ? `${result}` : "";
  }

  private getThinkingColor(): ThemeColor {
    switch (this.getThinkingLevel()) {
      case "minimal":
        return "thinkingMinimal";
      case "low":
        return "thinkingLow";
      case "medium":
        return "thinkingMedium";
      case "high":
        return "thinkingHigh";
      case "xhigh":
        return "thinkingXhigh";
      default:
        return "thinkingOff";
    }
  }

  private fg(color: ThemeColor, text: string): string {
    return this.ctx.ui.theme.fg(color, text);
  }

  private wrapBody(line: string, innerWidth: number): string {
    const clipped = truncateToWidth(line, innerWidth, "");
    const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)));
    const bg = this.getBg();
    const patched = clipped.replaceAll(RESET, `${RESET}${bg}`);
    return `${bg} ${patched}${padding} ${RESET}`;
  }
}

export default function (pi: ExtensionAPI) {
  let activeCtx: ExtensionContext | undefined;
  let activeThinkingLevel = "off";
  let paletteOpen = false;

  function getCommandItems(): CommandPaletteItem[] {
    const extensionCommands = pi.getCommands().map((cmd) => {
      const scope = cmd.sourceInfo?.scope === "user" ? "u" : "p";
      const origin = cmd.sourceInfo?.source ?? cmd.source ?? "extension";
      return {
        name: cmd.name,
        description: cmd.description,
        source: `${scope}:${origin}`,
      };
    });
    return [...BUILTIN_COMMANDS, ...extensionCommands];
  }

  function openPalette(ctx: ExtensionContext): void {
    if (paletteOpen || !ctx.hasUI) return;
    paletteOpen = true;

    void ctx.ui
      .custom<CommandPaletteResult | null>(
        (tui, theme, keybindings, done) =>
          new CommandPalette(getCommandItems(), tui, theme, keybindings, done),
        {
          overlay: true,
          overlayOptions: {
            anchor: "center",
            width: 90,
            maxHeight: "70%",
          },
        },
      )
      .then((result) => {
        paletteOpen = false;
        if (!result) return;
        if (result.action === "insert") {
          ctx.ui.setEditorText(`/${result.command} `);
        } else {
          ctx.ui.setEditorText(`/${result.command}`);
          // Trigger submit by simulating enter isn't available,
          // so just insert the command for the user to press enter
        }
      })
      .catch(() => {
        paletteOpen = false;
      });
  }

  pi.registerShortcut("ctrl+p", {
    description: "Open command palette",
    handler: async (ctx) => {
      openPalette(ctx);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    activeCtx = ctx;
    activeThinkingLevel = pi.getThinkingLevel();

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      return new FlatEditor(
        tui,
        theme,
        keybindings,
        () => activeCtx ?? ctx,
        () => activeThinkingLevel,
      );
    });

    ctx.ui.setFooter(() => ({
      invalidate() {},
      render() {
        return [];
      },
    }));
  });

  pi.on("thinking_level_select", (event) => {
    activeThinkingLevel = event.level;
  });

  pi.on("before_agent_start", () => {
    activeThinkingLevel = pi.getThinkingLevel();
  });
}

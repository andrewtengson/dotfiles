/**
 * Compact command palette overlay.
 * Fixed-height, bg-colored panel, no borders.
 * Layout: name [source] description
 */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { type Component, fuzzyFilter, Key, type KeybindingsManager, matchesKey, type TUI, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const MAX_VISIBLE = 10;
const RESET = "\x1b[0m";

export interface CommandPaletteItem {
  name: string;
  description?: string;
  source?: string;
  shortcut?: string;
}

export interface CommandPaletteResult {
  command: string;
  action: "insert" | "submit";
}

export const BUILTIN_COMMANDS: CommandPaletteItem[] = [
  { name: "settings", description: "Open settings", source: "builtin" },
  { name: "model", description: "Select model", source: "builtin" },
  { name: "scoped-models", description: "Model cycling", source: "builtin" },
  { name: "new", description: "New session", source: "builtin" },
  { name: "resume", description: "Switch session", source: "builtin" },
  { name: "fork", description: "Fork session", source: "builtin" },
  { name: "tree", description: "Session tree", source: "builtin" },
  { name: "name", description: "Rename session", source: "builtin" },
  { name: "compact", description: "Compact context", source: "builtin" },
  { name: "share", description: "Share session", source: "builtin" },
  { name: "export", description: "Export session", source: "builtin" },
  { name: "import", description: "Import session", source: "builtin" },
  { name: "clone", description: "Duplicate session", source: "builtin" },
  { name: "copy", description: "Copy last message", source: "builtin" },
  { name: "session", description: "Session info", source: "builtin" },
  { name: "hotkeys", description: "Show shortcuts", source: "builtin" },
  { name: "changelog", description: "Show changelog", source: "builtin" },
  { name: "reload", description: "Reload config", source: "builtin" },
  { name: "login", description: "Configure auth", source: "builtin" },
  { name: "logout", description: "Remove auth", source: "builtin" },
  { name: "quit", description: "Quit Pi", source: "builtin" },
];

function fgToBackground(fgAnsi: string): string {
  // Convert \x1b[38;2;r;g;bm to \x1b[48;2;r;g;bm
  return fgAnsi.replace("\x1b[38;", "\x1b[48;");
}

export class CommandPalette implements Component {
  private query = "";
  private selectedIndex = 0;
  private scrollOffset = 0;
  private panelBg: string;
  private selectedBg: string;
  private selectedFg: string;

  constructor(
    private readonly items: CommandPaletteItem[],
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly keybindings: KeybindingsManager,
    private readonly done: (result: CommandPaletteResult | null) => void,
  ) {
    // Derive colors from theme
    this.panelBg = theme.getBgAnsi("selectedBg");
    // Use accent (neutral-blue) as selection bg by converting fg ANSI to bg
    this.selectedBg = fgToBackground(theme.getFgAnsi("accent"));
    // Dark text on colored bg
    this.selectedFg = "\x1b[38;2;29;32;33m";
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (this.keybindings.matches(data, "tui.select.cancel") || matchesKey(data, Key.escape)) {
      this.done(null);
      return;
    }

    if (this.keybindings.matches(data, "tui.select.up")) {
      this.move(-1);
      return;
    }

    if (this.keybindings.matches(data, "tui.select.down")) {
      this.move(1);
      return;
    }

    if (this.keybindings.matches(data, "tui.input.tab") || matchesKey(data, Key.tab)) {
      this.select("insert");
      return;
    }

    if (this.keybindings.matches(data, "tui.select.confirm")) {
      this.select("submit");
      return;
    }

    if (matchesKey(data, Key.backspace) || this.keybindings.matches(data, "tui.editor.deleteCharBackward")) {
      this.query = this.query.slice(0, -1);
      this.reset();
      return;
    }

    if (data === "\x15" || this.keybindings.matches(data, "tui.editor.deleteToLineStart")) {
      this.query = "";
      this.reset();
      return;
    }

    if (data.length === 1 && data >= " " && data !== "\x7f") {
      this.query += data;
      this.reset();
    }
  }

  render(width: number): string[] {
    const w = Math.max(40, width);
    const items = this.getFiltered();
    this.clamp(items);

    const lines: string[] = [];

    // Header
    lines.push(this.line(w, this.panelBg, this.fg("text", "Commands"), this.fg("muted", "esc")));
    lines.push(this.pad(w));

    // Search
    const input = this.query ? `/${this.fg("text", this.query)}` : this.fg("dim", "/...");
    lines.push(this.line(w, this.panelBg, input, ""));
    lines.push(this.pad(w));

    // Items
    const visible = items.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE);
    if (visible.length === 0) {
      lines.push(this.line(w, this.panelBg, this.fg("muted", "No matches"), ""));
    } else {
      for (let i = 0; i < visible.length; i++) {
        const idx = this.scrollOffset + i;
        const bg = idx === this.selectedIndex ? this.selectedBg : this.panelBg;
        lines.push(this.itemLine(w, bg, visible[i], idx === this.selectedIndex));
      }
    }

    // Pad to fixed height
    const target = 4 + MAX_VISIBLE + 2;
    while (lines.length < target) lines.push(this.pad(w));

    // Footer
    lines.push(this.line(w, this.panelBg, this.fg("dim", "\u2191\u2193 navigate \u00b7 enter run \u00b7 tab insert \u00b7 esc close"), ""));

    return lines;
  }

  private move(delta: number): void {
    const items = this.getFiltered();
    if (items.length === 0) return;
    this.selectedIndex = Math.max(0, Math.min(items.length - 1, this.selectedIndex + delta));
    this.ensureVisible();
    this.tui.requestRender();
  }

  private reset(): void {
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.tui.requestRender();
  }

  private select(action: "insert" | "submit"): void {
    const items = this.getFiltered();
    const sel = items[this.selectedIndex];
    if (!sel) { this.done(null); return; }
    const finalAction = (sel.source === "skill" || sel.source === "prompt") ? "insert" : action;
    this.done({ command: sel.name, action: finalAction });
  }

  private clamp(items: CommandPaletteItem[]): void {
    if (items.length === 0) { this.selectedIndex = 0; return; }
    this.selectedIndex = Math.min(this.selectedIndex, items.length - 1);
    this.ensureVisible();
  }

  private ensureVisible(): void {
    if (this.selectedIndex < this.scrollOffset) this.scrollOffset = this.selectedIndex;
    if (this.selectedIndex >= this.scrollOffset + MAX_VISIBLE) this.scrollOffset = this.selectedIndex - MAX_VISIBLE + 1;
  }

  private getFiltered(): CommandPaletteItem[] {
    const all = dedup(this.items);
    if (!this.query.trim()) return all;
    return fuzzyFilter(all, this.query, (item) =>
      [item.name, item.description, item.source].filter(Boolean).join(" ")
    );
  }

  /** Full-width line with left/right content */
  private line(width: number, bg: string, left: string, right: string): string {
    const inner = width - 2;
    const lw = visibleWidth(left);
    const rw = visibleWidth(right);
    const gap = Math.max(1, inner - lw - rw);
    const raw = ` ${left}${" ".repeat(gap)}${right} `;
    // Ensure full width coverage
    const rawW = visibleWidth(raw);
    const extra = Math.max(0, width - rawW);
    const patched = raw.replaceAll(RESET, RESET + bg); return `${bg}${patched}${" ".repeat(extra)}${RESET}`;
  }

  /** Item line: name [source] description */
  private itemLine(width: number, bg: string, item: CommandPaletteItem, selected: boolean): string {
    const inner = width - 2;
    const sf = selected ? this.selectedFg : "";

    const srcTag = item.source ? `[${item.source}]` : "";
    const desc = item.description || "";

    // Three fixed columns with 1 space gap between each
    const nameCol = Math.max(4, Math.min(22, Math.floor(inner * 0.25)));
    const srcCol = Math.max(10, Math.min(24, Math.floor(inner * 0.30)));
    const descCol = Math.max(0, inner - nameCol - srcCol - 3);

    // Truncate+pad each column to exact fixed width (pad=true)
    const namePadded = truncateToWidth(item.name, nameCol, "\u2026", true);
    const srcPadded = truncateToWidth(srcTag, srcCol, "\u2026", true);
    const descPadded = truncateToWidth(desc, descCol, "\u2026", true);

    const totalW = 1 + nameCol + 1 + srcCol + 1 + descCol + 1;
    const trailing = Math.max(0, width - totalW);

    if (selected) {
      // Plain text — sf colors everything uniformly, replaceAll catches any internal resets
      const assembled = ` ${namePadded} ${srcPadded} ${descPadded} ${" ".repeat(trailing)}`;
      const patched = assembled.replaceAll(RESET, RESET + bg + sf);
      return `${bg}${sf}${patched}${RESET}`;
    }

    // Non-selected: color each column individually
    const nameStr = this.fg("text", namePadded);
    const srcStr = this.fg("dim", srcPadded);
    const descStr = this.fg("muted", descPadded);
    const assembled = ` ${nameStr} ${srcStr} ${descStr} `;
    const patched = assembled.replaceAll(RESET, RESET + bg);
    return `${bg}${patched}${" ".repeat(trailing)}${RESET}`;
  }

  /** Empty padded line */
  private pad(width: number): string {
    return `${this.panelBg}${" ".repeat(width)}${RESET}`;
  }

  private fg(color: ThemeColor, text: string): string {
    return this.theme.fg(color, text);
  }
}

function dedup(items: CommandPaletteItem[]): CommandPaletteItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

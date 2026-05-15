/**
 * btw-ui — dynamic-height bottom-slot overlay for /btw.
 * Copied from @juicesharp/rpiv-btw with import path adjustment.
 */

import type {
  ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { OverlayOptions } from "@earendil-works/pi-tui";
import {
  type Component,
  Key,
  matchesKey,
  type TUI,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { type BtwTurn, userMessageText } from "./btw.js";

const BTW_OVERLAY_OPTIONS: OverlayOptions = {
  anchor: "bottom-center",
  width: "100%",
  maxHeight: "85%",
  margin: { left: 0, right: 0, bottom: 0 },
};

const BTW_MAX_HEIGHT_RATIO = 0.85;

const SIDE_PAD = "  ";
const ANSWER_PAD = "    ";
const BTW_LITERAL = "/btw";
const PENDING_GLYPH = "\u2026";
const FOOTER_SCROLL = "\u2191/\u2193 to scroll";
const FOOTER_CLEAR = "x to clear history";
const FOOTER_DISMISS = "Esc to dismiss";
const FOOTER_SEP = " \u00B7 ";

type Mode = "pending" | "answer" | "error";

export interface ShowBtwOverlayParams {
  ctx: ExtensionCommandContext;
  question: string;
  history: BtwTurn[];
  controller: AbortController;
  onClearHistory: () => void;
}

export interface ShowBtwOverlayResult {
  overlayPromise: Promise<void>;
  controllerReady: Promise<BtwOverlayController>;
}

export class BtwOverlayController implements Component {
  private mode: Mode = "pending";
  private answer = "";
  private error = "";
  private scrollOffset = 0;
  private history: BtwTurn[];

  constructor(
    private readonly question: string,
    history: BtwTurn[],
    private readonly theme: Theme,
    private readonly tui: TUI,
    private readonly done: (result?: undefined) => void,
    private readonly controller: AbortController,
    private readonly onClearHistory: () => void,
  ) {
    this.history = [...history];
  }

  setAnswer(text: string): void {
    this.mode = "answer";
    this.answer = text;
    this.tui.requestRender();
  }

  setError(message: string): void {
    this.mode = "error";
    this.error = message;
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.controller.abort();
      this.done();
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.scrollOffset = this.scrollOffset + 1;
      this.tui.requestRender();
      return;
    }
    if (data === "x") {
      this.history = [];
      this.onClearHistory();
      this.scrollOffset = 0;
      this.tui.requestRender();
      return;
    }
  }

  render(width: number): string[] {
    const banner = this.renderBanner(width);
    const historyLines = this.history.map((h) =>
      this.historyLine(userMessageText(h.userMessage), width),
    );
    const echoLine = this.echoLine(this.question, width);
    const answerLines = this.renderAnswer(width);
    const footerAvail = Math.max(1, width - SIDE_PAD.length);
    const footerParts: string[] = [];
    if (this.mode !== "pending") footerParts.push(FOOTER_SCROLL);
    if (this.history.length > 0) footerParts.push(FOOTER_CLEAR);
    footerParts.push(FOOTER_DISMISS);
    const footer =
      SIDE_PAD +
      truncateToWidth(
        this.theme.fg("dim", footerParts.join(FOOTER_SEP)),
        footerAvail,
        "\u2026",
        false,
      );

    const natural: string[] = [
      banner,
      "",
      ...historyLines,
      echoLine,
      "",
      ...answerLines,
      "",
      footer,
    ];

    const termRows = (this.tui.terminal as { rows?: number }).rows ?? 24;
    const maxRows = Math.max(4, Math.floor(termRows * BTW_MAX_HEIGHT_RATIO));
    if (natural.length <= maxRows) {
      return natural;
    }
    const excess = natural.length - maxRows;
    if (this.scrollOffset > excess) this.scrollOffset = excess;
    const start = excess - this.scrollOffset;
    return natural.slice(start, start + maxRows);
  }

  invalidate(): void {}

  private renderBanner(width: number): string {
    const prefix = `${SIDE_PAD}${BTW_LITERAL} `;
    const prefixWidth = visibleWidth(prefix);
    const qAvail = Math.max(0, width - prefixWidth);
    const qTrunc = truncateToWidth(this.question, qAvail, "\u2026", false);
    const raw = prefix + qTrunc;
    const padded = raw + " ".repeat(Math.max(0, width - visibleWidth(raw)));
    return this.theme.bg(
      "customMessageBg",
      this.theme.fg("customMessageText", padded),
    );
  }

  private historyLine(question: string, width: number): string {
    const qAvail = Math.max(0, width - SIDE_PAD.length);
    const qClean = question.replace(/\s+/g, " ").trim();
    const raw = `${BTW_LITERAL} ${qClean}`;
    const trunc = truncateToWidth(raw, qAvail, "\u2026", false);
    return SIDE_PAD + this.theme.fg("muted", trunc);
  }

  private echoLine(question: string, width: number): string {
    const bodyAvail = Math.max(1, width - SIDE_PAD.length);
    const prefixWidth = visibleWidth(BTW_LITERAL) + 1;
    const qAvail = Math.max(0, bodyAvail - prefixWidth);
    const qClean = question.replace(/\s+/g, " ").trim();
    const qTrunc = truncateToWidth(qClean, qAvail, "\u2026", false);
    return `${SIDE_PAD + this.theme.fg("accent", BTW_LITERAL)} ${this.theme.fg("muted", qTrunc)}`;
  }

  private renderAnswer(width: number): string[] {
    const bodyWidth = Math.max(1, width - ANSWER_PAD.length);
    const indent = (lines: string[]) => lines.map((l) => ANSWER_PAD + l);

    if (this.mode === "pending") {
      return indent([this.theme.fg("warning", PENDING_GLYPH)]);
    }
    if (this.mode === "error") {
      const out: string[] = [];
      for (const ln of this.error.split("\n")) {
        const src = ln.length === 0 ? " " : ln;
        out.push(...wrapTextWithAnsi(this.theme.fg("error", src), bodyWidth));
      }
      return indent(out);
    }
    const out: string[] = [];
    for (const ln of this.answer.split("\n")) {
      const src = ln.length === 0 ? " " : ln;
      out.push(...wrapTextWithAnsi(src, bodyWidth));
    }
    return indent(out);
  }
}

export function showBtwOverlay(
  params: ShowBtwOverlayParams,
): ShowBtwOverlayResult {
  let resolveReady!: (controller: BtwOverlayController) => void;
  const controllerReady = new Promise<BtwOverlayController>((resolve) => {
    resolveReady = resolve;
  });

  const overlayPromise = params.ctx.ui.custom<void>(
    (tui, theme, _kb, done) => {
      const controller = new BtwOverlayController(
        params.question,
        params.history,
        theme,
        tui,
        done,
        params.controller,
        params.onClearHistory,
      );
      resolveReady(controller);
      return controller;
    },
    { overlay: true, overlayOptions: BTW_OVERLAY_OPTIONS },
  );

  return { overlayPromise, controllerReady };
}

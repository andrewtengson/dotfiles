/**
 * /btw floating window rendered with pi's own chat components, so the side session looks like a
 * normal pi session: user messages, assistant markdown and thinking, tool calls with pi's tool
 * renderers, and pi's editor as the input.
 *
 * Keys: Enter sends (steers while the side agent is working), Esc aborts a running turn or closes
 * when idle, Ctrl+O expands tool output, Ctrl+L starts a fresh side session, PgUp/PgDn scroll.
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";
import {
  type AgentSession,
  type AgentSessionEvent,
  AssistantMessageComponent,
  CustomEditor,
  getMarkdownTheme,
  getPackageDir,
  getSelectListTheme,
  type KeybindingsManager,
  type Theme,
  ToolExecutionComponent,
  type ToolRenderers,
  UserMessageComponent,
} from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Container,
  type Focusable,
  Key,
  Loader,
  matchesKey,
  type OverlayOptions,
  Spacer,
  Text,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";

const WIDTH_RATIO = 0.9;
const HEIGHT_RATIO = 0.85;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 12;
const SCROLL_STEP = 5;
const SEP = " · ";
const ELLIPSIS = "\u2026";
const HIDDEN_THINKING_LABEL = "Thinking...";

const BORDER = {
  topLeft: "\u256d",
  topRight: "\u256e",
  bottomLeft: "\u2570",
  bottomRight: "\u256f",
  horizontal: "\u2500",
  vertical: "\u2502",
};

export const BTW_OVERLAY_OPTIONS: OverlayOptions = {
  anchor: "center",
  width: `${WIDTH_RATIO * 100}%`,
  minWidth: MIN_WIDTH,
  maxHeight: `${HEIGHT_RATIO * 100}%`,
};

export interface BtwDisplaySettings {
  outputPad: 0 | 1;
  hideThinkingBlock: boolean;
  showImages: boolean;
  imageWidthCells: number;
  codeBlockIndent: string;
}

export interface BtwOverlayHandlers {
  onSubmit(text: string): void;
  onAbort(): void;
  onReset(): void;
  onClose(): void;
}

type RendererResolver = (
  toolName: string,
  base: ToolRenderers | undefined,
) => ToolRenderers | undefined;

/**
 * pi's built-in tool renderers (bash `$ cmd`, read previews, edit diffs) are attached by interactive
 * mode and not exported. Load them from the installed pi package; without them tools render with
 * pi's generic fallback.
 */
let builtInRenderers: Promise<RendererResolver | undefined> | undefined;
function loadBuiltInRenderers(): Promise<RendererResolver | undefined> {
  builtInRenderers ??= (async () => {
    try {
      // Extensions resolve pi through pi's module mapping, not node_modules, so import.meta.resolve
      // cannot find it. Locate the install through pi's own package directory instead.
      const path = join(
        getPackageDir(),
        "dist",
        "core",
        "tools",
        "renderers",
        "index.js",
      );
      const mod = (await import(pathToFileURL(path).href)) as {
        withBuiltInRenderers?: RendererResolver;
      };
      return mod.withBuiltInRenderers;
    } catch (error) {
      console.warn(
        `[btw] built-in tool renderers unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  })();
  return builtInRenderers;
}

export class BtwOverlay implements Component, Focusable {
  private readonly chat = new Container();
  private readonly editor: CustomEditor;
  private readonly loader: Loader;
  private readonly pendingTools = new Map<string, ToolExecutionComponent>();
  private streaming: AssistantMessageComponent | undefined;
  private session: AgentSession | undefined;
  private seedCount = 0;
  private modelLabel = "";
  private status: string | undefined;
  private toolsExpanded = false;
  private scroll = 0;
  private resolveRenderers: RendererResolver | undefined;
  private _focused = false;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    keybindings: KeybindingsManager,
    private readonly settings: BtwDisplaySettings,
    private readonly handlers: BtwOverlayHandlers,
  ) {
    this.editor = new CustomEditor(
      tui,
      {
        borderColor: (s) => theme.fg("borderMuted", s),
        selectList: getSelectListTheme(),
      },
      keybindings,
      { paddingX: 1 },
    );
    this.editor.onSubmit = (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      this.editor.addToHistory(trimmed);
      this.editor.setText("");
      this.scroll = 0;
      handlers.onSubmit(trimmed);
    };
    this.editor.onEscape = () => {
      if (this.session?.isStreaming) handlers.onAbort();
      else handlers.onClose();
    };
    this.editor.onAction("app.tools.expand", () => this.toggleToolsExpanded());
    this.loader = new Loader(
      tui,
      (s) => theme.fg("accent", s),
      (s) => theme.fg("muted", s),
      "Working",
    );
    void loadBuiltInRenderers().then((resolve) => {
      this.resolveRenderers = resolve;
    });
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.editor.focused = value;
  }

  /** Show a session's side thread and follow its events. Returns an unsubscribe function. */
  attach(
    session: AgentSession,
    seedCount: number,
    modelLabel: string,
  ): () => void {
    this.session = session;
    this.seedCount = seedCount;
    this.modelLabel = modelLabel;
    this.rebuild();
    const unsubscribe = session.subscribe((event) => this.onEvent(event));
    return () => {
      unsubscribe();
      this.loader.stop();
    };
  }

  /** Forget the current session's thread, e.g. after Ctrl+L. */
  detach(): void {
    this.session = undefined;
    this.modelLabel = "";
    this.loader.stop();
    this.chat.clear();
    this.pendingTools.clear();
    this.streaming = undefined;
    this.scroll = 0;
    this.tui.requestRender();
  }

  setStatus(status: string | undefined): void {
    this.status = status;
    if (status) {
      this.loader.setMessage(status);
      this.loader.start();
    } else if (!this.session?.isStreaming) {
      this.loader.stop();
    }
    this.tui.requestRender();
  }

  showError(message: string): void {
    this.chat.addChild(new Spacer(1));
    this.chat.addChild(
      new Text(this.theme.fg("error", message), this.settings.outputPad, 0),
    );
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl("l"))) {
      if (this.session?.isStreaming) return;
      this.handlers.onReset();
      return;
    }
    if (matchesKey(data, Key.pageUp)) {
      this.scroll += SCROLL_STEP;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.pageDown)) {
      this.scroll = Math.max(0, this.scroll - SCROLL_STEP);
      this.tui.requestRender();
      return;
    }
    this.editor.handleInput(data);
    this.tui.requestRender();
  }

  invalidate(): void {
    this.chat.invalidate();
    this.editor.invalidate();
  }

  render(width: number): string[] {
    // Border on each side; pi components add their own outputPad.
    const inner = Math.max(1, width - 2);
    const rows = (this.tui.terminal as { rows?: number }).rows ?? 24;
    const height = Math.max(MIN_HEIGHT, Math.floor(rows * HEIGHT_RATIO));

    const editor = this.editor.render(inner);
    const busy = Boolean(this.status) || this.session?.isStreaming === true;
    const status = busy ? this.loader.render(inner) : [];
    // top border + chat + status + editor + bottom border
    const budget = Math.max(1, height - 2 - editor.length - status.length);

    const body = this.chat.render(inner);
    if (body.length === 0) body.push(...this.emptyState(inner));
    const maxScroll = Math.max(0, body.length - budget);
    if (this.scroll > maxScroll) this.scroll = maxScroll;
    const end = body.length - this.scroll;
    const visible = body.slice(Math.max(0, end - budget), end);
    const filler = Array.from({ length: budget - visible.length }, () => "");

    return [
      this.topBorder(width),
      ...filler.map((line) => this.row(line, inner)),
      ...visible.map((line) => this.row(line, inner)),
      ...status.map((line) => this.row(line, inner)),
      ...editor.map((line) => this.row(line, inner)),
      this.bottomBorder(width),
    ];
  }

  private emptyState(width: number): string[] {
    const text =
      "Side session with full tools. It starts from the main conversation; nothing here reaches it.";
    return new Text(
      this.theme.fg("dim", text),
      this.settings.outputPad,
      0,
    ).render(width);
  }

  private markdownTheme() {
    return {
      ...getMarkdownTheme(),
      codeBlockIndent: this.settings.codeBlockIndent,
    };
  }

  private renderers(toolName: string): ToolRenderers | undefined {
    const session = this.session;
    if (!session) return undefined;
    const base = () => {
      const definition = session.getToolDefinition(toolName);
      return this.resolveRenderers
        ? this.resolveRenderers(toolName, definition)
        : definition;
    };
    return session.extensionRunner.resolveToolRenderers(toolName, base);
  }

  private toolComponent(
    name: string,
    id: string,
    args: unknown,
  ): ToolExecutionComponent {
    const component = new ToolExecutionComponent(
      name,
      id,
      args,
      {
        showImages: this.settings.showImages,
        imageWidthCells: this.settings.imageWidthCells,
        outputPad: this.settings.outputPad,
      },
      this.renderers(name),
      this.tui,
      this.session?.sessionManager.getCwd() ?? process.cwd(),
    );
    component.setExpanded(this.toolsExpanded);
    return component;
  }

  private assistantComponent(
    message?: AssistantMessage,
  ): AssistantMessageComponent {
    return new AssistantMessageComponent(
      message,
      this.settings.hideThinkingBlock,
      this.markdownTheme(),
      HIDDEN_THINKING_LABEL,
      this.settings.outputPad,
    );
  }

  private addUser(text: string): void {
    this.chat.addChild(new Spacer(1));
    this.chat.addChild(
      new UserMessageComponent(
        text,
        this.markdownTheme(),
        this.settings.outputPad,
      ),
    );
  }

  /** Render the side thread from the session's messages, like pi does when resuming a session. */
  private rebuild(): void {
    this.chat.clear();
    this.pendingTools.clear();
    this.streaming = undefined;
    const session = this.session;
    if (!session) return;

    const messages = session.messages.slice(this.seedCount) as Message[];
    const results = new Map<string, Message & { role: "toolResult" }>();
    for (const m of messages)
      if (m.role === "toolResult") results.set(m.toolCallId, m);

    for (const message of messages) {
      if (message.role === "user") {
        this.addUser(userText(message));
      } else if (message.role === "assistant") {
        this.chat.addChild(this.assistantComponent(message));
        for (const block of message.content) {
          if (block.type !== "toolCall") continue;
          const component = this.toolComponent(
            block.name,
            block.id,
            block.arguments,
          );
          const result = results.get(block.id);
          if (result) {
            component.updateResult({
              content: result.content,
              details: result.details,
              isError: result.isError,
            });
          } else if (
            message.stopReason === "aborted" ||
            message.stopReason === "error"
          ) {
            component.updateResult({
              content: [
                {
                  type: "text",
                  text: message.errorMessage ?? "Operation aborted",
                },
              ],
              isError: true,
            });
          } else {
            this.pendingTools.set(block.id, component);
          }
          this.chat.addChild(component);
        }
      }
    }
    if (session.isStreaming) this.loader.start();
    this.tui.requestRender();
  }

  /** Mirror of interactive mode's event handling for chat messages and tool executions. */
  private onEvent(event: AgentSessionEvent): void {
    switch (event.type) {
      case "agent_start":
        this.loader.setMessage("Working");
        this.loader.start();
        break;
      case "message_start":
        if (event.message.role === "user") {
          this.addUser(userText(event.message as Message & { role: "user" }));
        } else if (event.message.role === "assistant") {
          this.streaming = this.assistantComponent();
          this.chat.addChild(this.streaming);
          this.streaming.updateContent(event.message as AssistantMessage, true);
        }
        break;
      case "message_update":
        if (this.streaming && event.message.role === "assistant") {
          const message = event.message as AssistantMessage;
          this.streaming.updateContent(message, true);
          for (const block of message.content) {
            if (block.type !== "toolCall") continue;
            const existing = this.pendingTools.get(block.id);
            if (existing) {
              existing.updateArgs(block.arguments);
            } else {
              const component = this.toolComponent(
                block.name,
                block.id,
                block.arguments,
              );
              this.chat.addChild(component);
              this.pendingTools.set(block.id, component);
            }
          }
        }
        break;
      case "message_end":
        if (this.streaming && event.message.role === "assistant") {
          const message = event.message as AssistantMessage;
          this.streaming.updateContent(message, false);
          if (
            message.stopReason === "aborted" ||
            message.stopReason === "error"
          ) {
            const text =
              message.errorMessage ??
              (message.stopReason === "aborted"
                ? "Operation aborted"
                : "Error");
            for (const component of this.pendingTools.values()) {
              component.updateResult({
                content: [{ type: "text", text }],
                isError: true,
              });
            }
            this.pendingTools.clear();
          } else {
            for (const component of this.pendingTools.values())
              component.setArgsComplete();
          }
          this.streaming = undefined;
        }
        break;
      case "tool_execution_start": {
        // Nested calls (from codemode scripts) render inside their parent's row.
        if ("parentToolCallId" in event && event.parentToolCallId) break;
        let component = this.pendingTools.get(event.toolCallId);
        if (!component) {
          component = this.toolComponent(
            event.toolName,
            event.toolCallId,
            event.args,
          );
          this.chat.addChild(component);
          this.pendingTools.set(event.toolCallId, component);
        }
        component.markExecutionStarted();
        break;
      }
      case "tool_execution_update":
        this.pendingTools
          .get(event.toolCallId)
          ?.updateResult({ ...event.partialResult, isError: false }, true);
        break;
      case "tool_execution_end": {
        const component = this.pendingTools.get(event.toolCallId);
        if (component) {
          component.updateResult({
            ...event.result,
            isError: event.isError,
            durationMs: event.durationMs,
          });
          this.pendingTools.delete(event.toolCallId);
        }
        break;
      }
      case "agent_end":
        if (this.streaming) {
          this.chat.removeChild(this.streaming);
          this.streaming = undefined;
        }
        this.pendingTools.clear();
        if (!this.status) this.loader.stop();
        break;
      default:
        return;
    }
    this.tui.requestRender();
  }

  private toggleToolsExpanded(): void {
    this.toolsExpanded = !this.toolsExpanded;
    for (const child of this.chat.children) {
      if (child instanceof ToolExecutionComponent)
        child.setExpanded(this.toolsExpanded);
    }
    this.tui.requestRender();
  }

  /** `│<line padded to inner>│`. */
  private row(line: string, inner: number): string {
    const v = this.theme.fg("borderMuted", BORDER.vertical);
    const fitted =
      visibleWidth(line) > inner
        ? truncateToWidth(line, inner, "", false)
        : line;
    const pad = " ".repeat(Math.max(0, inner - visibleWidth(fitted)));
    return `${v}${fitted}${pad}${v}`;
  }

  /** `╭─ /btw ──── model ─╮` */
  private topBorder(width: number): string {
    const title = ` ${this.theme.fg("accent", "/btw")} `;
    const label = this.modelLabel
      ? ` ${this.theme.fg("muted", this.modelLabel)} `
      : "";
    return this.borderLine(
      width,
      BORDER.topLeft,
      BORDER.topRight,
      title,
      label,
    );
  }

  /** `╰─ esc close · ctrl+l new ──╯` */
  private bottomBorder(width: number): string {
    const busy = this.session?.isStreaming === true;
    const parts = busy
      ? ["enter steer", "esc abort"]
      : ["esc close", "ctrl+l new"];
    const scrolled = this.scroll > 0 ? [`\u2193 ${this.scroll} more`] : [];
    const hints = ` ${this.theme.fg("dim", [...scrolled, ...parts].join(SEP))} `;
    return this.borderLine(
      width,
      BORDER.bottomLeft,
      BORDER.bottomRight,
      hints,
      "",
    );
  }

  private borderLine(
    width: number,
    left: string,
    right: string,
    start: string,
    end: string,
  ): string {
    const h = (n: number) =>
      this.theme.fg("borderMuted", BORDER.horizontal.repeat(Math.max(0, n)));
    const corner = (c: string) => this.theme.fg("borderMuted", c);
    const room = Math.max(0, width - 4);
    let startText = start;
    let endText = end;
    if (visibleWidth(startText) + visibleWidth(endText) > room) endText = "";
    if (visibleWidth(startText) > room)
      startText = truncateToWidth(startText, room, ELLIPSIS, false);
    const gap = room - visibleWidth(startText) - visibleWidth(endText);
    return `${corner(left)}${h(1)}${startText}${h(gap)}${endText}${h(1)}${corner(right)}`;
  }
}

function userText(message: Message & { role: "user" }): string {
  if (typeof message.content === "string") return message.content;
  return message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n");
}

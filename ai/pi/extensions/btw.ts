/**
 * Patched /btw extension — fixes Bedrock "toolConfig must be defined" error
 * by stripping toolUse/toolResult blocks from the cloned conversation.
 *
 * Drop-in replacement for npm:@juicesharp/rpiv-btw.
 * Remove the package from settings.json and add this extension instead.
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	BTW_COMMAND_NAME,
	clearSessionHistory,
	executeBtw,
	type BtwTurn,
	registerInvalidationHooks,
	registerMessageEndSnapshot,
	userMessageText,
} from "./lib/btw/btw.js";
import { showBtwOverlay } from "./lib/btw/btw-ui.js";

function getSessionHistory(ctx: ExtensionContext): BtwTurn[] {
	const BTW_STATE_KEY = Symbol.for("rpiv-btw");
	const g = globalThis as unknown as { [k: symbol]: { histories: Map<string, BtwTurn[]> } | undefined };
	const state = g[BTW_STATE_KEY];
	if (!state) return [];
	const key = ctx.sessionManager.getSessionFile() ?? `memory:${ctx.sessionManager.getSessionId()}`;
	return state.histories.get(key) ?? [];
}

async function handleBtwCommand(_pi: ExtensionAPI, args: string, ctx: ExtensionCommandContext): Promise<void> {
	if (!ctx.hasUI) {
		ctx.ui.notify("/btw requires interactive mode", "error");
		return;
	}
	const question = args.trim();
	if (!question) {
		ctx.ui.notify("Usage: /btw <question>", "warning");
		return;
	}
	if (!ctx.model) {
		ctx.ui.notify("/btw requires an active model", "error");
		return;
	}

	const controller = new AbortController();
	const historySnapshot = [...getSessionHistory(ctx)];

	const { overlayPromise, controllerReady } = showBtwOverlay({
		ctx,
		question,
		history: historySnapshot,
		controller,
		onClearHistory: () => clearSessionHistory(ctx),
	});

	const overlayCtl = await controllerReady;
	const result = await executeBtw(question, ctx, controller);

	if (result.ok && result.answer && result.userMessage && result.assistantMessage) {
		overlayCtl.setAnswer(result.answer);
		// Push to history via the same globalThis state
		const BTW_STATE_KEY = Symbol.for("rpiv-btw");
		const g = globalThis as unknown as { [k: symbol]: { histories: Map<string, BtwTurn[]> } | undefined };
		const state = g[BTW_STATE_KEY];
		if (state) {
			const key = ctx.sessionManager.getSessionFile() ?? `memory:${ctx.sessionManager.getSessionId()}`;
			let turns = state.histories.get(key);
			if (!turns) {
				turns = [];
				state.histories.set(key, turns);
			}
			turns.push({ userMessage: result.userMessage, assistantMessage: result.assistantMessage });
		}
	} else if (result.aborted) {
		// User Esc'd
	} else if (result.error) {
		overlayCtl.setError(result.error);
	}

	await overlayPromise;
}

export default function (pi: ExtensionAPI): void {
	pi.registerCommand(BTW_COMMAND_NAME, {
		description: "Ask a side question without polluting the main conversation",
		handler: (args: string, ctx: ExtensionCommandContext) => handleBtwCommand(pi, args, ctx),
	});
	registerMessageEndSnapshot(pi);
	registerInvalidationHooks(pi);
}

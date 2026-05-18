/**
 * /usage - Show AI provider usage (Claude, Kiro, Copilot, Gemini, Codex)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

// ============================================================================
// Types
// ============================================================================

interface RateWindow {
  label: string;
  usedPercent: number;
  detail?: string;
}

interface UsageSnapshot {
  provider: string;
  windows: RateWindow[];
  plan?: string;
  error?: string;
}

// ============================================================================
// Region helpers
// ============================================================================

const KIRO_API_REGIONS: Record<string, string> = {
  "ap-southeast-1": "us-east-1",
  "ap-southeast-2": "us-east-1",
  "ap-northeast-1": "us-east-1",
  "ap-south-1": "us-east-1",
  "us-west-1": "us-east-1",
  "us-west-2": "us-east-1",
  "us-east-2": "us-east-1",
  "eu-west-1": "eu-central-1",
  "eu-west-2": "eu-central-1",
  "eu-west-3": "eu-central-1",
  "eu-north-1": "eu-central-1",
};

function readPiAuth(): Record<string, Record<string, unknown>> {
  try {
    return JSON.parse(
      readFileSync(join(homedir(), ".pi/agent/auth.json"), "utf8"),
    );
  } catch {
    return {};
  }
}

function formatReset(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ============================================================================
// Kiro
// ============================================================================

async function fetchKiroUsage(): Promise<UsageSnapshot> {
  const auth = readPiAuth();
  const token = auth.kiro?.access as string | undefined;
  if (!token) return { provider: "Kiro", windows: [], error: "Not logged in" };

  const ssoRegion = (auth.kiro?.region as string) || "us-east-1";
  const region = KIRO_API_REGIONS[ssoRegion] ?? ssoRegion;

  try {
    const resp = await fetch(`https://q.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.0",
        "X-Amz-Target": "AmazonCodeWhispererService.GetUsageLimits",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        origin: "CLI",
        resourceType: "CREDIT",
        isEmailRequired: false,
      }),
    });
    if (!resp.ok)
      return { provider: "Kiro", windows: [], error: `HTTP ${resp.status}` };

    // biome-ignore lint/suspicious/noExplicitAny: untyped API response
    const data = (await resp.json()) as any;
    const bucket = data.usageBreakdownList?.[0] ?? data.usageBreakdown;
    if (!bucket) return { provider: "Kiro", windows: [], error: "No data" };

    const used = bucket.currentUsageWithPrecision ?? bucket.currentUsage ?? 0;
    const limit = bucket.usageLimitWithPrecision ?? bucket.usageLimit ?? 0;
    const overages =
      bucket.currentOveragesWithPrecision ?? bucket.currentOverages ?? 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    const resetDate = data.nextDateReset
      ? new Date(data.nextDateReset * 1000)
      : undefined;

    const windows: RateWindow[] = [
      {
        label: "Credits",
        usedPercent: Math.min(pct, 100),
        detail: `${used.toFixed(1)}/${limit}${resetDate ? ` resets ${formatReset(resetDate)}` : ""}`,
      },
    ];
    if (overages > 0) {
      const cap = bucket.overageCapWithPrecision ?? bucket.overageCap ?? 0;
      const overagePct = cap > 0 ? (overages / cap) * 100 : 50;
      windows.push({
        label: "Overage",
        usedPercent: Math.min(overagePct, 100),
        detail: `${overages.toFixed(1)} extra ($${(bucket.overageCharges ?? 0).toFixed(2)})`,
      });
    }

    const plan =
      (data.subscriptionInfo?.subscriptionTitle as string) ?? undefined;
    return { provider: "Kiro", windows, plan };
  } catch (e) {
    return {
      provider: "Kiro",
      windows: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================================
// Claude (Anthropic)
// ============================================================================

async function fetchClaudeUsage(): Promise<UsageSnapshot> {
  const auth = readPiAuth();
  let token = auth.anthropic?.access as string | undefined;

  if (!token) {
    try {
      const keychain = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: "utf-8" },
      ).trim();
      if (keychain) {
        const parsed = JSON.parse(keychain);
        token = parsed.claudeAiOauth?.accessToken;
      }
    } catch {
      // no keychain
    }
  }

  if (!token)
    return { provider: "Claude", windows: [], error: "Not logged in" };

  try {
    const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
    });
    if (!resp.ok)
      return { provider: "Claude", windows: [], error: `HTTP ${resp.status}` };

    // biome-ignore lint/suspicious/noExplicitAny: untyped API response
    const data = (await resp.json()) as any;
    const windows: RateWindow[] = [];

    if (data.five_hour?.utilization !== undefined) {
      const reset = data.five_hour.resets_at
        ? formatReset(new Date(data.five_hour.resets_at))
        : undefined;
      windows.push({
        label: "5h",
        usedPercent: data.five_hour.utilization,
        detail: reset ? `resets ${reset}` : undefined,
      });
    }
    if (data.seven_day?.utilization !== undefined) {
      windows.push({ label: "Week", usedPercent: data.seven_day.utilization });
    }

    return { provider: "Claude", windows };
  } catch (e) {
    return {
      provider: "Claude",
      windows: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================================
// Gemini
// ============================================================================

async function fetchGeminiUsage(): Promise<UsageSnapshot> {
  const auth = readPiAuth();
  let token = auth["google-gemini-cli"]?.access as string | undefined;

  if (!token) {
    const credPath = join(homedir(), ".gemini/oauth_creds.json");
    try {
      if (existsSync(credPath)) {
        const data = JSON.parse(readFileSync(credPath, "utf8"));
        token = data.access_token;
      }
    } catch {
      // no creds
    }
  }

  if (!token)
    return { provider: "Gemini", windows: [], error: "Not logged in" };

  try {
    const resp = await fetch(
      "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    if (!resp.ok)
      return { provider: "Gemini", windows: [], error: `HTTP ${resp.status}` };

    // biome-ignore lint/suspicious/noExplicitAny: untyped API response
    const data = (await resp.json()) as any;
    let proMin = 1;
    let flashMin = 1;
    let hasPro = false;
    let hasFlash = false;

    for (const bucket of data.buckets || []) {
      const model = (bucket.modelId || "").toLowerCase();
      const frac = bucket.remainingFraction ?? 1;
      if (model.includes("pro")) {
        hasPro = true;
        if (frac < proMin) proMin = frac;
      }
      if (model.includes("flash")) {
        hasFlash = true;
        if (frac < flashMin) flashMin = frac;
      }
    }

    const windows: RateWindow[] = [];
    if (hasPro) windows.push({ label: "Pro", usedPercent: (1 - proMin) * 100 });
    if (hasFlash)
      windows.push({ label: "Flash", usedPercent: (1 - flashMin) * 100 });

    return { provider: "Gemini", windows };
  } catch (e) {
    return {
      provider: "Gemini",
      windows: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================================
// Codex (OpenAI)
// ============================================================================

async function fetchCodexUsage(): Promise<UsageSnapshot> {
  const auth = readPiAuth();
  const token = (auth["openai-codex"]?.access ?? auth.openai?.access) as
    | string
    | undefined;

  if (!token) return { provider: "Codex", windows: [], error: "Not logged in" };

  try {
    const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok)
      return { provider: "Codex", windows: [], error: `HTTP ${resp.status}` };

    // biome-ignore lint/suspicious/noExplicitAny: untyped API response
    const data = (await resp.json()) as any;
    const windows: RateWindow[] = [];

    if (data.rate_limit?.primary_window) {
      const pw = data.rate_limit.primary_window;
      const hours = Math.round((pw.limit_window_seconds || 10800) / 3600);
      const reset = pw.reset_at
        ? formatReset(new Date(pw.reset_at * 1000))
        : undefined;
      windows.push({
        label: `${hours}h`,
        usedPercent: pw.used_percent || 0,
        detail: reset ? `resets ${reset}` : undefined,
      });
    }
    if (data.rate_limit?.secondary_window) {
      const sw = data.rate_limit.secondary_window;
      const hours = Math.round((sw.limit_window_seconds || 86400) / 3600);
      const label = hours >= 168 ? "Week" : hours >= 24 ? "Day" : `${hours}h`;
      const reset = sw.reset_at
        ? formatReset(new Date(sw.reset_at * 1000))
        : undefined;
      windows.push({
        label,
        usedPercent: sw.used_percent || 0,
        detail: reset ? `resets ${reset}` : undefined,
      });
    }

    return { provider: "Codex", windows, plan: data.plan_type };
  } catch (e) {
    return {
      provider: "Codex",
      windows: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ============================================================================
// UI
// ============================================================================

function renderBar(
  pct: number,
  width: number,
  theme: { fg: (c: string, s: string) => string },
): string {
  const filled = Math.min(width, Math.round((pct / 100) * width));
  const empty = width - filled;
  const color = pct >= 90 ? "error" : pct >= 70 ? "warning" : "success";
  return (
    theme.fg(color, "\u2588".repeat(filled)) +
    theme.fg("muted", "\u2591".repeat(empty))
  );
}

class UsageComponent {
  private usages: UsageSnapshot[] = [];
  private loading = true;
  // biome-ignore lint/suspicious/noExplicitAny: pi TUI type
  private tui: any;
  // biome-ignore lint/suspicious/noExplicitAny: pi theme type
  private theme: any;
  private done: () => void;

  // biome-ignore lint/suspicious/noExplicitAny: pi TUI types not exported
  constructor(tui: any, theme: any, done: () => void, provider: string) {
    this.tui = tui;
    this.theme = theme;
    this.done = done;
    this.load(provider);
  }

  private async load(provider: string) {
    const fetchers: Record<string, () => Promise<UsageSnapshot>> = {
      kiro: fetchKiroUsage,
      anthropic: fetchClaudeUsage,
      "google-gemini-cli": fetchGeminiUsage,
      "openai-codex": fetchCodexUsage,
      openai: fetchCodexUsage,
    };

    const fetcher = fetchers[provider];
    if (fetcher) {
      try {
        this.usages = [await fetcher()];
      } catch {
        this.usages = [];
      }
    } else {
      this.usages = [
        { provider, windows: [], error: "No usage API for this provider" },
      ];
    }

    this.loading = false;
    this.tui.requestRender();
  }

  handleInput(_data: string): void {
    this.done();
  }

  invalidate(): void {}
  dispose(): void {}

  render(width: number): string[] {
    const t = this.theme;
    const dim = (s: string) => t.fg("muted", s);
    const bold = (s: string) => t.bold(s);
    const accent = (s: string) => t.fg("accent", s);

    const boxW = Math.min(56, width - 2);
    const innerW = boxW - 4;
    const hLine = "\u2500".repeat(boxW - 2);

    const box = (content: string) => {
      const pad = Math.max(0, innerW - visibleWidth(content));
      return `${dim("\u2502")} ${content}${" ".repeat(pad)} ${dim("\u2502")}`;
    };

    const lines: string[] = [];
    lines.push(dim(`\u256d${hLine}\u256e`));
    lines.push(box(bold(accent("Provider Usage"))));
    lines.push(dim(`\u251c${hLine}\u2524`));

    if (this.loading) {
      lines.push(box("Loading..."));
    } else if (this.usages.length === 0) {
      lines.push(box(dim("No providers configured")));
    } else {
      for (const u of this.usages) {
        const planStr = u.plan ? dim(` (${u.plan})`) : "";
        lines.push(box(bold(u.provider) + planStr));

        if (u.error) {
          lines.push(box(dim(`  ${u.error}`)));
        } else {
          for (const w of u.windows) {
            const bar = renderBar(w.usedPercent, 12, t);
            const pctStr = `${Math.round(w.usedPercent)}%`.padStart(4);
            const detail = w.detail ? dim(` ${w.detail}`) : "";
            lines.push(box(`  ${w.label.padEnd(8)} ${bar} ${pctStr}${detail}`));
          }
        }
        lines.push(box(""));
      }
    }

    lines.push(dim(`\u251c${hLine}\u2524`));
    lines.push(box(dim("Press any key to close")));
    lines.push(dim(`\u2570${hLine}\u256f`));

    return lines;
  }
}

// ============================================================================
// Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Show AI provider usage",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) return;
      const provider = String(ctx.model?.provider ?? "");
      await ctx.ui.custom((_tui, theme, _kb, done) => {
        return new UsageComponent(_tui, theme, () => done(), provider);
      });
    },
  });
}

/**
 * AWS SSO Auto-Login Extension
 *
 * Sets AWS_PROFILE for Bedrock inference and keeps the SSO token valid.
 *
 * Hooks:
 *   - Async factory: catches expired token at startup (before Pi connects to Bedrock)
 *   - before_agent_start: catches expiration when user sends a message
 *
 * Handles both legacy SSO profiles (cache keyed by start URL) and
 * session-based SSO profiles (cache keyed by sso_session name).
 *
 * Configure in ~/.pi/agent/settings.json:
 *   { "awsProfile": "isse-se-prod" }
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LOGIN_TIMEOUT_MS = 180_000;

function getProfile(): string | undefined {
  try {
    const settingsPath = join(
      process.env.HOME ?? "",
      ".pi",
      "agent",
      "settings.json",
    );
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return settings.awsProfile;
  } catch {
    return undefined;
  }
}

function awsConfig(profile: string, key: string): string | undefined {
  try {
    return (
      execFileSync("aws", ["configure", "get", key, "--profile", profile], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

function getCacheKey(profile: string): string | undefined {
  return (
    awsConfig(profile, "sso_session") ?? awsConfig(profile, "sso_start_url")
  );
}

function isSsoTokenExpired(cacheKey: string): boolean {
  const hash = createHash("sha1").update(cacheKey).digest("hex");
  const cacheFile = join(homedir(), ".aws", "sso", "cache", `${hash}.json`);
  if (!existsSync(cacheFile)) return true;
  try {
    const data = JSON.parse(readFileSync(cacheFile, "utf-8"));
    const expiresAt = new Date(data.expiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return true;
    return Date.now() >= expiresAt;
  } catch {
    return true;
  }
}

export default async function (pi: ExtensionAPI) {
  const settingsPath = join(
    process.env.HOME ?? "",
    ".pi",
    "agent",
    "settings.json",
  );
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    if (settings.defaultProvider !== "amazon-bedrock") return;
  } catch {
    return;
  }

  const profile = getProfile();
  if (!profile) return;

  process.env.AWS_PROFILE = profile;

  const cacheKey = getCacheKey(profile);
  if (!cacheKey) return;

  async function runLogin(ctx?: ExtensionContext): Promise<void> {
    ctx?.ui.notify(
      `AWS SSO expired for ${profile}. Opening browser...`,
      "warning",
    );
    await pi.exec("aws", ["sso", "login", "--profile", profile], {
      timeout: LOGIN_TIMEOUT_MS,
    });
    if (isSsoTokenExpired(cacheKey!)) {
      ctx?.ui.notify("AWS SSO login failed. Bedrock calls may fail.", "error");
    } else {
      ctx?.ui.notify("AWS SSO refreshed.", "info");
    }
  }

  // Startup: runs before Pi connects to Bedrock (async factory is awaited)
  if (isSsoTokenExpired(cacheKey)) {
    await runLogin();
  }

  // After user sends a message
  pi.on("before_agent_start", async (_event, ctx) => {
    if (!isSsoTokenExpired(cacheKey)) return;
    if (!ctx.hasUI) return;
    await runLogin(ctx);
  });
}

#!/usr/bin/env bun
// MANUAL FALLBACK. The primary mechanism for keeping Kiro models fresh is the
// pi extension ai/pi/extensions/kiro-model-sync.ts, which writes
// ~/.kiro-models-cache.json on startup (the provider's getCachedModels reads
// that cache and it supersedes the hardcoded array). Use THIS script only when
// you need to patch the provider's static fallback array directly, e.g. the
// extension is disabled, kiro-cli is unavailable at launch, or you want the
// static list itself to carry a new model.
//
// Patches Pi's managed pi-provider-kiro install so `pi --list-models` and
// startup `enabledModels` validation reflect reality even without a cache.
// Idempotent — safe to re-run after CLI/provider upgrades.
//
// Source: `kiro-cli chat --list-models --format json` (no token needed).
// Run:    bun ai/pi/sync-kiro-models.ts
//
// The provider ships two dist layouts across versions:
//   1. Older: `var KIRO_MODEL_IDS = new Set([...])`, `var kiroModels = [...]`.
//   2. Newer: hoisted `var KIRO_MODEL_IDS, kiroModels, ...;` then bare
//      `KIRO_MODEL_IDS = new Set([...])` assignments inside an init closure,
//      plus a runtime cache fetched from ListAvailableModels.
//
// The startup warning ("No models match pattern kiro/<id>:<level>") comes from
// pi validating `enabledModels` against the provider's model list BEFORE any
// authenticated fetch runs — so it always sees the hardcoded fallback array.
// New models only reach that fallback via this sync.
//
// Strategy: ADDITIVE MERGE. We never wipe existing structures (that would drop
// per-region availability differences and per-model extras like
// thinkingLevelMap). We only inject models the CLI reports that the fallback is
// missing. Region availability for injected models is assumed us-east-1 + any
// region already present; the runtime ListAvailableModels fetch corrects the
// exact per-region set once credentials are used.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// pi loads pi-provider-kiro from its own managed npm tree, declared in
// ~/.pi/agent/npm/package.json ("name": "pi-extensions") and installed via bun.
// That is the ONLY dist pi reads. A global `bun install -g` copy under
// ~/.bun/install/global is NOT used by pi and is intentionally excluded.
// Override with a colon-separated PI_PROVIDER_KIRO_DIST to target other dirs.
const DEFAULT_DIST_DIRS = [
  join(homedir(), ".pi/agent/npm/node_modules/pi-provider-kiro/dist"),
];
const DIST_DIRS = (
  process.env.PI_PROVIDER_KIRO_DIST
    ? process.env.PI_PROVIDER_KIRO_DIST.split(":")
    : DEFAULT_DIST_DIRS
).filter((dir) => dir.length > 0);
const TARGET_FILES = ["index.js", "models.js"];

interface KiroCliModel {
  model_id: string;
  model_name: string;
  description?: string;
  context_window_tokens: number;
  rate_multiplier?: number;
  rate_unit?: string;
}
interface KiroCliResponse {
  models: KiroCliModel[];
  default_model?: string;
}

const raw = execSync("kiro-cli chat --list-models --format json", {
  encoding: "utf8",
  timeout: 15000,
});
const data = JSON.parse(raw) as KiroCliResponse;

// Non-reasoning models: everything defaults to reasoning-capable so new Kiro
// models pick up thinking-level suffixes (e.g. :medium) automatically without a
// code change. List only models that genuinely do NOT support extended
// thinking. Matches the provider's own runtime heuristic (opus/sonnet/coder/
// deepseek reason; the rest here do not).
const NON_REASONING_MODELS = new Set([
  "claude-haiku-4.5",
  "minimax-m2.5",
  "minimax-m2.1",
]);

// Models that only accept text (no image support).
const TEXT_ONLY = new Set(["minimax-m2.5", "glm-5"]);

// kiro id (dots) -> pi id (dashes in version numbers): claude-opus-4.8 -> claude-opus-4-8
const toPiId = (modelId: string): string =>
  modelId.replace(/(\d)\.(\d)/g, "$1-$2");

const modelObjectLiteral = (m: KiroCliModel): string => {
  const input = TEXT_ONLY.has(m.model_id) ? '["text"]' : '["text", "image"]';
  return `  {
    id: ${JSON.stringify(toPiId(m.model_id))},
    name: ${JSON.stringify(m.model_name || m.model_id)},
    api: "kiro-api",
    provider: "kiro",
    baseUrl: BASE_URL,
    reasoning: ${!NON_REASONING_MODELS.has(m.model_id)},
    input: ${input},
    cost: ZERO_COST,
    contextWindow: ${m.context_window_tokens},
    maxTokens: 64000
  }`;
};

// Locate a top-level structure declaration by name, supporting both the
// prefixed form (`var NAME = ...`) and the bare hoisted-assignment form
// (`NAME = ...`). Returns the [start, end) span of the initializer literal so we
// can insert into it without disturbing surrounding code or the declaration.
type Span = { openIndex: number; closeIndex: number };

// Matches a `new Set([...])` initializer bound either by assignment
// (`NAME = new Set([` bare, `var`, `const`, or `export const`) or as an
// object property (`"region": new Set([`). `binder` selects which.
const findSetSpan = (
  source: string,
  name: string,
  binder: "assign" | "property",
): Span | null => {
  const bind = binder === "assign" ? "=" : ":";
  const prefix =
    binder === "assign" ? "(?:export\\s+const\\s+|const\\s+|var\\s+)?" : "";
  const decl = new RegExp(
    `${prefix}${name}\\s*${bind}\\s*(?:/\\* @__PURE__ \\*/ )?new Set\\(\\[`,
  );
  const m = decl.exec(source);
  if (!m) return null;
  const openIndex = m.index + m[0].length; // just after `[`
  const closeIndex = source.indexOf("]", openIndex);
  if (closeIndex === -1) return null;
  return { openIndex, closeIndex };
};

const findArraySpan = (source: string, name: string): Span | null => {
  const decl = new RegExp(
    `(?:export\\s+const\\s+|const\\s+|var\\s+)?${name}\\s*=\\s*\\[`,
  );
  const m = decl.exec(source);
  if (!m) return null;
  const openIndex = m.index + m[0].length; // just after `[`
  // Balance brackets to find the matching close, tolerating nested arrays.
  let depth = 1;
  let i = openIndex;
  for (; i < source.length && depth > 0; i++) {
    const c = source[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
  }
  if (depth !== 0) return null;
  return { openIndex, closeIndex: i - 1 };
};

// The kiro-cli model list is authoritative for the API region the provider
// actually talks to (us-east-1). Note the provider maps most SSO regions to
// us-east-1 via API_REGION_MAP (e.g. ap-southeast-1 -> us-east-1), so this is
// the region that matters even when your SSO login is elsewhere. Other region
// sets (e.g. eu-central-1) have genuinely different availability and are left
// untouched; the provider's runtime ListAvailableModels fetch refines them
// per-credential.
const REGION_SET_NAMES = ["us-east-1"];

// Detect the indentation used by existing entries in a set/array body so
// injected lines line up with them. Falls back to `fallback`.
const detectIndent = (body: string, fallback: string): string => {
  const m = body.match(/\n([ \t]+)\S/);
  return m ? m[1] : fallback;
};

const insertIntoSetBody = (
  body: string,
  quotedIds: string[],
): { body: string; added: string[] } => {
  const present = new Set(
    Array.from(body.matchAll(/"([^"]+)"/g)).map((x) => x[1]),
  );
  const missing = quotedIds.filter((id) => !present.has(id));
  if (missing.length === 0) return { body, added: [] };
  const indent = detectIndent(body, "  ");
  const trimmed = body.replace(/\s*$/, "");
  const needsComma = /[^\s,[]$/.test(trimmed) && trimmed.length > 0;
  const prefix = needsComma ? "," : "";
  const additions = missing
    .map((id) => `${indent}${JSON.stringify(id)}`)
    .join(",\n");
  return { body: `${trimmed}${prefix}\n${additions}\n${indent.slice(0, -2)}`, added: missing };
};

const spliceSpan = (source: string, span: Span, newBody: string): string =>
  source.slice(0, span.openIndex) + newBody + source.slice(span.closeIndex);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const patchFile = (path: string): { added: string[] } => {
  let source = readFileSync(path, "utf8");
  const cliKiroIds = data.models.map((m) => m.model_id); // dotted
  const cliPiIds = data.models.map((m) => toPiId(m.model_id)); // dashed
  const addedOverall = new Set<string>();

  // 1. KIRO_MODEL_IDS uses dotted ids.
  const idsSpan = findSetSpan(source, "KIRO_MODEL_IDS", "assign");
  if (!idsSpan) fail(`Could not locate KIRO_MODEL_IDS in ${path}`);
  {
    const body = source.slice(idsSpan.openIndex, idsSpan.closeIndex);
    const { body: newBody, added } = insertIntoSetBody(body, cliKiroIds);
    for (const a of added) addedOverall.add(a);
    source = spliceSpan(source, idsSpan, newBody);
  }

  // 2. MODELS_BY_REGION: patch only the us-east-1 set (dashed pi ids), which is
  //    the API region the provider resolves to for this account. Add only ids
  //    not already present; other region sets are left as-is.
  for (const region of REGION_SET_NAMES) {
    const span = findSetSpan(source, `"${region}"`, "property");
    if (!span) continue;
    const body = source.slice(span.openIndex, span.closeIndex);
    const { body: newBody, added } = insertIntoSetBody(body, cliPiIds);
    for (const a of added) addedOverall.add(a);
    source = spliceSpan(source, span, newBody);
  }

  // 3. kiroModels array of objects, keyed on `id` (dashed). Append any model
  //    object whose id is not already present. Preserves existing objects and
  //    their per-model extras.
  const arrSpan = findArraySpan(source, "kiroModels");
  if (!arrSpan) fail(`Could not locate kiroModels in ${path}`);
  {
    const body = source.slice(arrSpan.openIndex, arrSpan.closeIndex);
    const presentIds = new Set(
      Array.from(body.matchAll(/id:\s*"([^"]+)"/g)).map((x) => x[1]),
    );
    const missing = data.models.filter(
      (m) => !presentIds.has(toPiId(m.model_id)),
    );
    if (missing.length > 0) {
      for (const m of missing) addedOverall.add(m.model_id);
      const literals = missing.map(modelObjectLiteral).join(",\n");
      const trimmed = body.replace(/\s*$/, "");
      const needsComma = /[^\s,[]$/.test(trimmed) && trimmed.length > 0;
      const prefix = needsComma ? "," : "";
      const newBody = `${trimmed}${prefix}\n${literals}\n`;
      source = spliceSpan(source, arrSpan, newBody);
    }
  }

  writeFileSync(path, source);
  return { added: Array.from(addedOverall) };
};

const targetPaths = DIST_DIRS.flatMap((dir) =>
  TARGET_FILES.map((file) => join(dir, file)),
).filter(existsSync);

if (targetPaths.length === 0) {
  console.error(
    `Could not locate pi-provider-kiro dist files in:\n${DIST_DIRS.map((d) => `  ${d}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(`Kiro CLI reports ${data.models.length} models.`);
for (const path of targetPaths) {
  const { added } = patchFile(path);
  const summary =
    added.length > 0 ? `added ${added.join(", ")}` : "already up to date";
  console.log(`  ${path}\n    ${summary}`);
}

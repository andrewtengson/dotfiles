#!/usr/bin/env bun
// Sync the Kiro model catalog into Pi's managed pi-provider-kiro install
// so `pi --list-models` reflects reality. Idempotent — re-run after upgrades.
//
// Source: `kiro-cli chat --list-models --format json` (no token needed).
// Run:    bun ai/pi/sync-kiro-models.ts

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIST_DIR =
  process.env.PI_PROVIDER_KIRO_DIST ??
  join(homedir(), ".pi/agent/npm/node_modules/pi-provider-kiro/dist");
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

// Models that support extended thinking.
const REASONING_MODELS = new Set([
  "auto",
  "claude-opus-4.7",
  "claude-opus-4.6",
  "claude-sonnet-4.6",
  "claude-opus-4.5",
  "claude-sonnet-4.5",
  "claude-sonnet-4",
  "deepseek-3.2",
  "kimi-k2.5",
  "glm-5",
  "qwen3-coder-next",
]);

// Models that only accept text (no image support).
const TEXT_ONLY = new Set(["minimax-m2.5", "glm-5"]);

const piId = (modelId: string): string =>
  modelId.replace(/(\d)\.(\d)/g, "$1-$2");

const toPiModel = (m: KiroCliModel): string => {
  const input = TEXT_ONLY.has(m.model_id) ? '["text"]' : '["text", "image"]';

  return `  {
    id: ${JSON.stringify(piId(m.model_id))},
    name: ${JSON.stringify(m.model_name || m.model_id)},
    api: "kiro-api",
    provider: "kiro",
    baseUrl: BASE_URL,
    reasoning: ${REASONING_MODELS.has(m.model_id)},
    input: ${input},
    cost: ZERO_COST,
    contextWindow: ${m.context_window_tokens},
    maxTokens: 64000
  }`;
};

const piIds = data.models.map((m) => piId(m.model_id));
const kiroIdEntries = data.models
  .map((m) => `  ${JSON.stringify(m.model_id)}`)
  .join(",\n");
const setEntries = piIds.map((id) => `    ${JSON.stringify(id)}`).join(",\n");
const newArrayBody = data.models.map(toPiModel).join(",\n");

const replacementDeclaration = (
  source: string,
  name: string,
  exportable: boolean,
): string => {
  if (source.includes(`export const ${name}`)) {
    return `export const ${name}`;
  }
  if (source.includes(`const ${name}`)) {
    return `const ${name}`;
  }
  if (source.includes(`var ${name}`)) {
    return `var ${name}`;
  }
  return exportable ? `export const ${name}` : `const ${name}`;
};

const replaceOrExit = (
  source: string,
  pattern: RegExp,
  replacement: string,
  label: string,
  path: string,
): string => {
  if (!pattern.test(source)) {
    console.error(`Could not locate ${label} in ${path}`);
    process.exit(1);
  }
  return source.replace(pattern, replacement);
};

const patchFile = (path: string): void => {
  const dist = readFileSync(path, "utf8");
  let patched = dist;

  const idsDeclaration = replacementDeclaration(
    patched,
    "KIRO_MODEL_IDS",
    true,
  );
  patched = replaceOrExit(
    patched,
    /(?:export const|const|var) KIRO_MODEL_IDS = (?:\/\* @__PURE__ \*\/ )?new Set\(\[[\s\S]*?\n\]\);/,
    `${idsDeclaration} = /* @__PURE__ */ new Set([\n${kiroIdEntries}\n]);`,
    "KIRO_MODEL_IDS",
    path,
  );

  const modelsDeclaration = replacementDeclaration(patched, "kiroModels", true);
  patched = replaceOrExit(
    patched,
    /(?:export const|const|var) kiroModels = \[[\s\S]*?\n\];/,
    `${modelsDeclaration} = [\n${newArrayBody}\n];`,
    "kiroModels",
    path,
  );

  const regionDeclaration = replacementDeclaration(
    patched,
    "MODELS_BY_REGION",
    false,
  );
  patched = replaceOrExit(
    patched,
    /(?:const|var) MODELS_BY_REGION = \{[\s\S]*?\n\};/,
    `${regionDeclaration} = {
  "us-east-1": /* @__PURE__ */ new Set([\n${setEntries}\n  ]),
  "eu-central-1": /* @__PURE__ */ new Set([\n${setEntries}\n  ])
};`,
    "MODELS_BY_REGION",
    path,
  );

  const regionMapDeclaration = replacementDeclaration(
    patched,
    "API_REGION_MAP",
    false,
  );
  patched = replaceOrExit(
    patched,
    /(?:const|var) API_REGION_MAP = \{[\s\S]*?\n\};/,
    `${regionMapDeclaration} = {
  "us-west-1": "us-east-1",
  "us-west-2": "us-east-1",
  "us-east-2": "us-east-1",
  "ap-southeast-1": "us-east-1",
  "ap-southeast-2": "us-east-1",
  "ap-northeast-1": "us-east-1",
  "ap-south-1": "us-east-1",
  "eu-west-1": "eu-central-1",
  "eu-west-2": "eu-central-1",
  "eu-west-3": "eu-central-1",
  "eu-north-1": "eu-central-1",
  "eu-south-1": "eu-central-1",
  "eu-south-2": "eu-central-1",
  "eu-central-2": "eu-central-1"
};`,
    "API_REGION_MAP",
    path,
  );

  writeFileSync(path, patched);
};

const targetPaths = TARGET_FILES.map((file) => join(DIST_DIR, file)).filter(
  existsSync,
);

if (targetPaths.length === 0) {
  console.error(`Could not locate pi-provider-kiro dist files in ${DIST_DIR}`);
  process.exit(1);
}

for (const path of targetPaths) {
  patchFile(path);
}

console.log(`Synced ${data.models.length} Kiro models into:`);
for (const path of targetPaths) {
  console.log(`  ${path}`);
}
console.log("Models:");
for (const m of data.models) {
  const piId = m.model_id.replace(/(\d)\.(\d)/g, "$1-$2");
  console.log(
    `  ${piId.padEnd(22)} ${m.context_window_tokens.toLocaleString().padStart(10)} ctx`,
  );
}

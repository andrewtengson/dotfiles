#!/usr/bin/env bun
// Sync the Kiro model catalog into pi-provider-kiro's bundled dist/index.js
// so `pi --list-models` reflects reality. Idempotent — re-run after upgrades.
//
// Source: `kiro-cli chat --list-models --format json` (no token needed).
// Run:    bun ai/pi/sync-kiro-models.ts

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIST_PATH = join(
  homedir(),
  ".bun/install/global/node_modules/pi-provider-kiro/dist/index.js",
);

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

const toPiModel = (m: KiroCliModel): string => {
  const piId = m.model_id.replace(/(\d)\.(\d)/g, "$1-$2");
  const input = TEXT_ONLY.has(m.model_id) ? '["text"]' : '["text", "image"]';

  return `  {
    id: ${JSON.stringify(piId)},
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

const newArrayBody = data.models.map(toPiModel).join(",\n");
const newBlock = `var kiroModels = [\n${newArrayBody}\n];`;

const dist = readFileSync(DIST_PATH, "utf8");

// 1. Replace kiroModels array.
const modelsPattern = /var kiroModels = \[[\s\S]*?\n\];/;
if (!modelsPattern.test(dist)) {
  console.error("Could not locate `var kiroModels = [...]` in", DIST_PATH);
  process.exit(1);
}
let patched = dist.replace(modelsPattern, newBlock);

// 2. Replace MODELS_BY_REGION with the fetched model IDs (all regions get the same set).
const piIds = data.models.map((m) =>
  m.model_id.replace(/(\d)\.(\d)/g, "$1-$2"),
);
const setEntries = piIds.map((id) => `    ${JSON.stringify(id)}`).join(",\n");
const newRegionBlock = `var MODELS_BY_REGION = {
  "us-east-1": /* @__PURE__ */ new Set([\n${setEntries}\n  ]),
  "eu-central-1": /* @__PURE__ */ new Set([\n${setEntries}\n  ])
};`;
const regionPattern = /var MODELS_BY_REGION = \{[\s\S]*?\n\};/;
if (regionPattern.test(patched)) {
  patched = patched.replace(regionPattern, newRegionBlock);
} else {
  console.warn(
    "Could not locate MODELS_BY_REGION — skipping region filter patch",
  );
}

// 3. Ensure API_REGION_MAP includes all APAC/EU regions that route to us-east-1 or eu-central-1.
const newRegionMap = `var API_REGION_MAP = {
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
};`;
const regionMapPattern = /var API_REGION_MAP = \{[\s\S]*?\n\};/;
if (regionMapPattern.test(patched)) {
  patched = patched.replace(regionMapPattern, newRegionMap);
} else {
  console.warn("Could not locate API_REGION_MAP — skipping region map patch");
}

writeFileSync(DIST_PATH, patched);

console.log(`Synced ${data.models.length} Kiro models:`);
for (const m of data.models) {
  const piId = m.model_id.replace(/(\d)\.(\d)/g, "$1-$2");
  console.log(
    `  ${piId.padEnd(22)} ${m.context_window_tokens.toLocaleString().padStart(10)} ctx`,
  );
}

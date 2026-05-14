/**
 * System theme extension for Pi.
 *
 * Reads terminal colors from Ghostty's theme config and generates
 * a Pi theme using OKLCH color science. Adapts automatically when
 * you change your Ghostty theme.
 *
 * Supports: Ghostty (via theme files). Falls back to defaults.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { generateSystemTheme, toPiThemeJson } from "./lib/system-theme.js";
import type { HexColor } from "./lib/color.js";

const THEME_DIR = join(homedir(), ".pi", "agent", "themes");
const THEME_PATH = join(THEME_DIR, "system.json");

interface TerminalPalette {
  background: HexColor;
  foreground: HexColor;
  palette: HexColor[];
}

/**
 * Read Ghostty's active theme colors.
 */
function readGhosttyColors(): TerminalPalette | null {
  const resourcesDir = process.env.GHOSTTY_RESOURCES_DIR;
  if (!resourcesDir) return null;

  // Find theme name from Ghostty config
  const configPaths = [
    join(homedir(), ".config", "ghostty", "config"),
    join(homedir(), "Library", "Application Support", "com.mitchellh.ghostty", "config"),
  ];

  let themeName: string | null = null;
  let inlineColors: Partial<TerminalPalette> = { palette: [] };

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;

    const content = readFileSync(configPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) continue;

      const [key, ...rest] = trimmed.split("=");
      const k = key?.trim();
      const v = rest.join("=").trim();

      if (k === "theme") themeName = v;
      if (k === "background") inlineColors.background = v as HexColor;
      if (k === "foreground") inlineColors.foreground = v as HexColor;
      if (k === "palette") {
        const [idx, color] = v.split("=");
        if (idx && color) {
          inlineColors.palette = inlineColors.palette || [];
          inlineColors.palette[parseInt(idx)] = color as HexColor;
        }
      }
    }
    break;
  }

  // If we have a theme name, read from theme file
  if (themeName) {
    const themePath = join(resourcesDir, "themes", themeName);
    if (existsSync(themePath)) {
      const result = parseGhosttyTheme(readFileSync(themePath, "utf-8"));
      // Override with inline config values
      if (inlineColors.background) result.background = inlineColors.background;
      if (inlineColors.foreground) result.foreground = inlineColors.foreground;
      return result;
    }
  }

  // Use inline colors if no theme file
  if (inlineColors.background && inlineColors.foreground) {
    return {
      background: inlineColors.background,
      foreground: inlineColors.foreground,
      palette: inlineColors.palette || [],
    };
  }

  return null;
}

function parseGhosttyTheme(content: string): TerminalPalette {
  let background = "#1d2021";
  let foreground = "#ebdbb2";
  const palette: HexColor[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();

    if (key === "background") background = value;
    if (key === "foreground") foreground = value;
    if (key === "palette") {
      const [idx, color] = value.split("=");
      if (idx && color) palette[parseInt(idx)] = color as HexColor;
    }
  }

  return { background, foreground, palette };
}

export default function (_pi: ExtensionAPI) {
  const colors = readGhosttyColors();

  const background = colors?.background || "#1d2021";
  const foreground = colors?.foreground || "#ebdbb2";
  const palette = colors?.palette || [];

  const theme = generateSystemTheme(background, foreground, palette);

  try {
    mkdirSync(THEME_DIR, { recursive: true });
    writeFileSync(THEME_PATH, toPiThemeJson(theme));
  } catch {
    return;
  }

  // Theme is written. Set "theme": "system" in settings to use it.
  // On subsequent startups, the theme regenerates from current terminal colors.
}

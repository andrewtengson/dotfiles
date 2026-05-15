/**
 * Generate a Pi theme JSON from terminal colors.
 * Uses OKLCH color science to derive a full palette from seed colors.
 */

import {
  type HexColor,
  isDarkBackground,
  generateScale,
  generateNeutralScale,
  shift,
  lighten,
} from "./color.js";

interface PiThemeColors {
  // Foreground colors (ThemeColor keys)
  accent: string;
  border: string;
  borderAccent: string;
  borderMuted: string;
  success: string;
  error: string;
  warning: string;
  muted: string;
  dim: string;
  text: string;
  thinkingText: string;
  userMessageText: string;
  customMessageText: string;
  customMessageLabel: string;
  toolTitle: string;
  toolOutput: string;
  mdHeading: string;
  mdLink: string;
  mdLinkUrl: string;
  mdCode: string;
  mdCodeBlock: string;
  mdCodeBlockBorder: string;
  mdQuote: string;
  mdQuoteBorder: string;
  mdHr: string;
  mdListBullet: string;
  toolDiffAdded: string;
  toolDiffRemoved: string;
  toolDiffContext: string;
  syntaxComment: string;
  syntaxKeyword: string;
  syntaxFunction: string;
  syntaxVariable: string;
  syntaxString: string;
  syntaxNumber: string;
  syntaxType: string;
  syntaxOperator: string;
  syntaxPunctuation: string;
  thinkingOff: string;
  thinkingMinimal: string;
  thinkingLow: string;
  thinkingMedium: string;
  thinkingHigh: string;
  thinkingXhigh: string;
  bashMode: string;
  // Background colors (ThemeBg keys)
  selectedBg: string;
  userMessageBg: string;
  customMessageBg: string;
  toolPendingBg: string;
  toolSuccessBg: string;
  toolErrorBg: string;
}

export interface SystemThemeResult {
  name: string;
  colors: PiThemeColors;
  pageBg: string;
}

/**
 * Generate a complete Pi theme from detected terminal colors.
 */
export function generateSystemTheme(background: HexColor, foreground: HexColor, palette?: HexColor[]): SystemThemeResult {
  const isDark = isDarkBackground(background);

  // Use ANSI palette colors as seeds when available (much better than deriving from bg)
  // ANSI: 0=black 1=red 2=green 3=yellow 4=blue 5=magenta 6=cyan 7=white
  const p = palette || [];
  const accentSeed = p[12] || p[4] || shift(background, { h: 180, l: isDark ? 0.4 : -0.3, c: 3.0 });
  const successSeed = p[10] || p[2] || shift(background, { h: 145, l: isDark ? 0.35 : -0.2, c: 4.0 });
  const errorSeed = p[9] || p[1] || shift(background, { h: 25, l: isDark ? 0.35 : -0.2, c: 4.0 });
  const warningSeed = p[11] || p[3] || shift(background, { h: 85, l: isDark ? 0.35 : -0.2, c: 4.0 });
  const infoSeed = p[14] || p[6] || shift(background, { h: 230, l: isDark ? 0.35 : -0.2, c: 4.0 });

  const neutral = generateNeutralScale(background, isDark);
  const accent = generateScale(accentSeed, isDark);
  const success = generateScale(successSeed, isDark);
  const error = generateScale(errorSeed, isDark);
  const warning = generateScale(warningSeed, isDark);
  const info = generateScale(infoSeed, isDark);

  // Derive orange from yellow seed (shift hue toward red)
  const orange = p[3] ? shift(p[3], { h: -30, c: 1.1 }) : warning[isDark ? 9 : 8];

  const colors: PiThemeColors = {
    // Core — palette colors directly
    accent: p[4] || accent[isDark ? 9 : 8],
    border: p[4] || accent[isDark ? 8 : 6],
    borderAccent: p[4] || accent[isDark ? 9 : 8],
    borderMuted: neutral[isDark ? 6 : 3],
    success: p[2] || success[isDark ? 9 : 8],
    error: p[1] || error[isDark ? 9 : 8],
    warning: orange,
    muted: p[7] || neutral[isDark ? 9 : 4],
    dim: p[8] || neutral[isDark ? 8 : 3],
    text: foreground,

    // Message colors
    thinkingText: lighten(foreground, isDark ? -0.12 : 0.12),
    userMessageText: foreground,
    customMessageText: foreground,
    customMessageLabel: p[2] || success[isDark ? 9 : 8],
    toolTitle: foreground,
    toolOutput: foreground,

    // Markdown
    mdHeading: p[3] || warning[isDark ? 9 : 8],
    mdLink: p[4] || accent[isDark ? 9 : 8],
    mdLinkUrl: p[7] || neutral[isDark ? 9 : 4],
    mdCode: p[6] || info[isDark ? 9 : 8],
    mdCodeBlock: foreground,
    mdCodeBlockBorder: neutral[isDark ? 7 : 4],
    mdQuote: lighten(foreground, isDark ? -0.12 : 0.12),
    mdQuoteBorder: p[2] || success[isDark ? 9 : 8],
    mdHr: neutral[isDark ? 6 : 5],
    mdListBullet: p[2] || success[isDark ? 9 : 8],

    // Diff
    toolDiffAdded: p[2] || success[isDark ? 9 : 8],
    toolDiffRemoved: p[1] || error[isDark ? 9 : 8],
    toolDiffContext: p[8] || neutral[isDark ? 8 : 4],

    // Syntax — matches gruvbox slot mapping
    syntaxComment: p[8] || neutral[isDark ? 8 : 4],
    syntaxKeyword: p[1] || error[isDark ? 9 : 8],
    syntaxFunction: p[2] || success[isDark ? 9 : 8],
    syntaxVariable: p[4] || accent[isDark ? 9 : 8],
    syntaxString: p[2] || success[isDark ? 9 : 8],
    syntaxNumber: p[5] || accent[isDark ? 9 : 8],
    syntaxType: p[3] || warning[isDark ? 9 : 8],
    syntaxOperator: foreground,
    syntaxPunctuation: p[7] || neutral[isDark ? 9 : 4],

    // Thinking levels — gray → blue → yellow → red
    thinkingOff: neutral[isDark ? 7 : 3],
    thinkingMinimal: neutral[isDark ? 8 : 4],
    thinkingLow: info[isDark ? 6 : 7],
    thinkingMedium: accent[isDark ? 7 : 8],
    thinkingHigh: warning[isDark ? 8 : 9],
    thinkingXhigh: error[isDark ? 8 : 9],
    bashMode: p[3] || warning[isDark ? 9 : 8],

    // Backgrounds
    selectedBg: lighten(background, isDark ? 0.08 : -0.08),
    userMessageBg: lighten(background, isDark ? 0.03 : -0.03),
    customMessageBg: lighten(background, isDark ? 0.03 : -0.03),
    toolPendingBg: lighten(background, isDark ? 0.03 : -0.03),
    toolSuccessBg: lighten(background, isDark ? 0.03 : -0.03),
    toolErrorBg: lighten(background, isDark ? 0.03 : -0.03),
  };

  return {
    name: "system",
    colors,
    pageBg: background,
  };
}

/**
 * Convert the generated theme to Pi's JSON format.
 */
export function toPiThemeJson(result: SystemThemeResult): string {
  const { colors, pageBg } = result;

  const theme = {
    $schema: "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
    name: "system",
    colors: {
      ...colors,
    },
    export: {
      pageBg,
      cardBg: colors.toolPendingBg,
      infoBg: colors.selectedBg,
    },
  };

  return JSON.stringify(theme, null, 2);
}

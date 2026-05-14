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

  const colors: PiThemeColors = {
    // Core — use palette colors directly for max contrast
    accent: p[4] || accent[isDark ? 9 : 8],
    border: accent[isDark ? 8 : 6],
    borderAccent: p[4] || accent[isDark ? 9 : 8],
    borderMuted: neutral[isDark ? 6 : 3],
    success: p[2] || success[isDark ? 9 : 8],
    error: p[1] || error[isDark ? 9 : 8],
    warning: p[3] || warning[isDark ? 9 : 8],
    muted: p[8] || neutral[isDark ? 9 : 4],
    dim: p[7] || neutral[isDark ? 8 : 3],
    text: foreground,

    // Message colors
    thinkingText: neutral[isDark ? 9 : 6],
    userMessageText: foreground,
    customMessageText: foreground,
    customMessageLabel: success[isDark ? 8 : 9],
    toolTitle: foreground,
    toolOutput: neutral[isDark ? 10 : 9],

    // Markdown
    mdHeading: warning[isDark ? 8 : 9],
    mdLink: accent[isDark ? 8 : 9],
    mdLinkUrl: p[8] || neutral[isDark ? 9 : 4],
    mdCode: success[isDark ? 8 : 9],
    mdCodeBlock: neutral[isDark ? 10 : 11],
    mdCodeBlockBorder: neutral[isDark ? 3 : 4],
    mdQuote: warning[isDark ? 8 : 9],
    mdQuoteBorder: success[isDark ? 6 : 7],
    mdHr: neutral[isDark ? 6 : 5],
    mdListBullet: success[isDark ? 8 : 9],

    // Diff
    toolDiffAdded: success[isDark ? 8 : 9],
    toolDiffRemoved: error[isDark ? 8 : 9],
    toolDiffContext: p[8] || neutral[isDark ? 9 : 4],

    // Syntax
    syntaxComment: p[8] || neutral[isDark ? 9 : 4],
    syntaxKeyword: accent[isDark ? 9 : 10],
    syntaxFunction: success[isDark ? 8 : 9],
    syntaxVariable: neutral[isDark ? 10 : 11],
    syntaxString: success[isDark ? 8 : 9],
    syntaxNumber: warning[isDark ? 8 : 9],
    syntaxType: info[isDark ? 8 : 9],
    syntaxOperator: p[7] || neutral[isDark ? 9 : 5],
    syntaxPunctuation: p[8] || neutral[isDark ? 9 : 4],

    // Thinking levels
    thinkingOff: neutral[isDark ? 7 : 3],
    thinkingMinimal: neutral[isDark ? 8 : 4],
    thinkingLow: info[isDark ? 6 : 7],
    thinkingMedium: accent[isDark ? 7 : 8],
    thinkingHigh: warning[isDark ? 8 : 9],
    thinkingXhigh: error[isDark ? 8 : 9],
    bashMode: warning[isDark ? 8 : 9],

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

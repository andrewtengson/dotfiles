export interface UsageBarTheme {
  fg: (color: string, text: string) => string;
}

export function renderBar(
  pct: number,
  width: number,
  theme: UsageBarTheme,
): string {
  const filled = Math.min(width, Math.max(1, Math.round((pct / 100) * width)));
  const empty = width - filled;
  const color = pct >= 90 ? "error" : pct >= 70 ? "warning" : "success";
  return (
    theme.fg(color, "\u2588".repeat(filled)) +
    theme.fg("muted", "\u2591".repeat(empty))
  );
}

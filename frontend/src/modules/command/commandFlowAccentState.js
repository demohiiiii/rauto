const COMMAND_FLOW_ACCENT_COLORS = Object.freeze([
  "oklch(0.63 0.18 157)",
  "oklch(0.67 0.13 220)",
  "oklch(0.72 0.14 85)",
  "oklch(0.67 0.16 35)",
  "oklch(0.62 0.14 285)",
  "oklch(0.68 0.14 340)",
]);

export function commandFlowAccentColor(itemIndex = 0) {
  const normalizedIndex = Number.isFinite(itemIndex)
    ? Math.trunc(itemIndex)
    : 0;
  const paletteIndex =
    ((normalizedIndex % COMMAND_FLOW_ACCENT_COLORS.length) +
      COMMAND_FLOW_ACCENT_COLORS.length) %
    COMMAND_FLOW_ACCENT_COLORS.length;
  return COMMAND_FLOW_ACCENT_COLORS[paletteIndex];
}

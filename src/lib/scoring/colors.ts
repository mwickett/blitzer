/**
 * Player accent palette used in ColorPicker, RaceTrack, Standings, and
 * automatic assignment.
 *
 * The first four entries are screen-tuned approximations of the printed
 * Dutch Blitz face colours (blue / red / yellow / green), darkened enough
 * to stay legible as score text on brand cream `#fff7ea` and as white
 * numerals on RaceTrack pips. Exact hexes are approximations pending a
 * photo sample under neutral light (#273); they intentionally replace the
 * cool Tailwind 500s that clashed with the warm brand palette.
 *
 * Copper and Rosewood are brand-warm extras so 5–6 player games still get
 * distinct colours before the palette wraps at 7+ (MAX_PLAYERS is 8).
 * Historical games keep whatever hex was stored at creation time.
 */
export const ACCENT_COLORS = [
  { value: "#356f9f", label: "Blue" },
  { value: "#c44536", label: "Red" },
  { value: "#8f6a0a", label: "Yellow" },
  { value: "#2f7a45", label: "Green" },
  { value: "#b85320", label: "Copper" },
  { value: "#9b4d5a", label: "Rosewood" },
] as const;

/** Brand cream background behind score text (Standings, score cards). */
export const ACCENT_CONTRAST_BG = "#fff7ea";

export type AccentColorValue = (typeof ACCENT_COLORS)[number]["value"];

export function resolvePlayerColor({
  gameColor,
  userDefault,
}: {
  gameColor: string | null;
  userDefault: string | null;
}): string | null {
  return gameColor ?? userDefault ?? null;
}

export function assignColorsToPlayers(
  players: { id: string; resolvedColor: string | null }[]
): Record<string, string> {
  const assigned: Record<string, string> = {};
  const usedColors = new Set<string>();

  // First pass: assign players who already have a color (first-come priority)
  for (const player of players) {
    if (player.resolvedColor && !usedColors.has(player.resolvedColor)) {
      assigned[player.id] = player.resolvedColor;
      usedColors.add(player.resolvedColor);
    }
  }

  // Second pass: assign remaining players the next available color
  const availableColors = ACCENT_COLORS.map((c) => c.value).filter(
    (c) => !usedColors.has(c)
  );
  const allColors = ACCENT_COLORS.map((c) => c.value);
  let colorIndex = 0;

  for (const player of players) {
    if (!assigned[player.id]) {
      if (colorIndex < availableColors.length) {
        assigned[player.id] = availableColors[colorIndex];
        usedColors.add(availableColors[colorIndex]);
      } else {
        // Palette exhausted (7+ players) — wrap around to reuse colors
        assigned[player.id] = allColors[colorIndex % allColors.length];
      }
      colorIndex++;
    }
  }

  return assigned;
}

/** Relative luminance per WCAG 2.x (sRGB). */
export function relativeLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio between two hex colours (order-independent). */
export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

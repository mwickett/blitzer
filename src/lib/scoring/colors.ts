export const ACCENT_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#ef4444", label: "Red" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f97316", label: "Orange" },
] as const;

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

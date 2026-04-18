import { ACCENT_COLORS } from "./colors";

/**
 * Update a player's color and cascade-bump any displaced player.
 * Returns a new color map (does not mutate the input).
 *
 * When fewer players than palette colors (≤6), duplicates are impossible.
 * When palette is exhausted (7+ players), the displaced player keeps
 * their current color — duplicates are tolerated, matching the base
 * allocator behavior in assignColorsToPlayers (colors.ts:49).
 */
export function resolveColorCascade(
  currentColors: Record<string, string>,
  playerId: string,
  newColor: string
): Record<string, string> {
  const next = { ...currentColors };

  // Find who (if anyone) currently holds the new color
  const displacedEntry = Object.entries(next).find(
    ([id, c]) => id !== playerId && c === newColor
  );

  // Remember the outgoing color before overwriting
  const oldColor = next[playerId];

  // Assign the new color
  next[playerId] = newColor;

  // Bump the displaced player to the first available accent color.
  // If the palette is exhausted (7+ players), fall back to the
  // color that was just freed by the current player.
  if (displacedEntry) {
    const usedColors = new Set(Object.values(next));
    const available = ACCENT_COLORS.find((c) => !usedColors.has(c.value));
    next[displacedEntry[0]] = available ? available.value : oldColor;
  }

  return next;
}

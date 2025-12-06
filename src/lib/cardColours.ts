// Card colours for Dutch Blitz
// Each player uses a deck with a distinct colour to identify their cards

export const CARD_COLOURS = [
  { value: "red", label: "Red", hex: "#dc2626" },
  { value: "blue", label: "Blue", hex: "#2563eb" },
  { value: "green", label: "Green", hex: "#16a34a" },
  { value: "yellow", label: "Yellow", hex: "#eab308" },
] as const;

export type CardColour = (typeof CARD_COLOURS)[number]["value"];

// Helper function to get colour info by value
export function getColourInfo(colour: string | null | undefined) {
  if (!colour) return null;
  return CARD_COLOURS.find((c) => c.value === colour);
}

// Helper function to get hex color for a colour value
export function getColourHex(colour: string | null | undefined): string | null {
  const info = getColourInfo(colour);
  return info?.hex ?? null;
}

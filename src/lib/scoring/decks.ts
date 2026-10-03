/**
 * The four Dutch Blitz deck symbols a player can play with. A deck is an
 * optional pick next to the accent colour: it never replaces the colour and
 * is not unique per game (two boxes can each bring a pump deck).
 */
export const DECKS = [
  { id: "plow", label: "Plow" },
  { id: "pump", label: "Pump" },
  { id: "bucket", label: "Bucket" },
  { id: "carriage", label: "Carriage" },
] as const;

export type DeckId = (typeof DECKS)[number]["id"];

export const DECK_IDS = DECKS.map((deck) => deck.id) as [DeckId, ...DeckId[]];

const LABELS = new Map<string, string>(DECKS.map((deck) => [deck.id, deck.label]));

export function isDeckId(value: unknown): value is DeckId {
  return typeof value === "string" && LABELS.has(value);
}

export function deckLabel(id: DeckId): string {
  return LABELS.get(id)!;
}

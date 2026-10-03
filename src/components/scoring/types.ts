export type EntryStatus = "empty" | "partial" | "complete";

/** "cards" is cards played plus Blitz pile left; "total" is "Do math" mode. */
export type EntryMode = "cards" | "total";

export interface PlayerEntry {
  blitzRemaining: number | null;
  cardsPlayed: number | null;
  /** The round's score, typed directly in "total" mode. */
  total: number | null;
}

export interface ScoringPlayer {
  id: string;
  name: string;
  color: string;
  isGuest: boolean;
  userId?: string;
  guestId?: string;
}

export interface PlayerWithScore extends ScoringPlayer {
  score: number;
}

export function getEntryStatus(
  entry: PlayerEntry,
  mode: EntryMode = "cards",
): EntryStatus {
  if (mode === "total") return entry.total === null ? "empty" : "complete";
  const hasBlitz = entry.blitzRemaining !== null && !isNaN(entry.blitzRemaining);
  const hasCards = entry.cardsPlayed !== null && !isNaN(entry.cardsPlayed);
  if (hasBlitz && hasCards) return "complete";
  if (hasBlitz || hasCards) return "partial";
  return "empty";
}

export interface RoundScoreData {
  userId?: string | null;
  guestId?: string | null;
  /** Null, like totalCardsPlayed, when the round total was typed. */
  blitzPileRemaining: number | null;
  totalCardsPlayed: number | null;
  typedScore?: number | null;
}

export interface RoundData {
  id: string;
  revision: number;
  scores: RoundScoreData[];
}

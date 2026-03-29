export type EntryStatus = "empty" | "partial" | "complete";

export interface PlayerEntry {
  blitzRemaining: number | null;
  cardsPlayed: number | null;
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

export function getEntryStatus(entry: PlayerEntry): EntryStatus {
  const hasBlitz = entry.blitzRemaining !== null && !isNaN(entry.blitzRemaining);
  const hasCards = entry.cardsPlayed !== null && !isNaN(entry.cardsPlayed);
  if (hasBlitz && hasCards) return "complete";
  if (hasBlitz || hasCards) return "partial";
  return "empty";
}

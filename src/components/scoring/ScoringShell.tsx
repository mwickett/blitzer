"use client";

import { ScoreEntryView } from "./ScoreEntryView";
import { type PlayerWithScore } from "./types";

export type ScoringMode = "entry" | "betweenRounds" | "editing" | "gameOver";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
  winnerName?: string;
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
}

export function ScoringShell({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
  isFinished,
}: ScoringShellProps) {
  // Derive mode from props — not useState — so it reacts to server state changes
  // after router.refresh() (App Router preserves client state but updates props).
  // Plans 2-4 will add betweenRounds, editing, and gameOver rendering.
  const mode: ScoringMode = isFinished ? "gameOver" : "entry";

  if (mode !== "entry") {
    return null;
  }

  return (
    <ScoreEntryView
      gameId={gameId}
      currentRoundNumber={currentRoundNumber}
      players={players}
      winThreshold={winThreshold}
    />
  );
}

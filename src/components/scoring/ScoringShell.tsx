"use client";

import { ScoreEntryView } from "./ScoreEntryView";
import { type PlayerWithScore } from "./types";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
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
}: ScoringShellProps) {
  // For Plan 1, only score entry mode.
  // Plans 2-4 will add between-rounds, editing, and game-over modes.
  return (
    <ScoreEntryView
      gameId={gameId}
      currentRoundNumber={currentRoundNumber}
      players={players}
      winThreshold={winThreshold}
    />
  );
}

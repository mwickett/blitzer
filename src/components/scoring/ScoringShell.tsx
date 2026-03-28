"use client";

import { useState } from "react";
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
  const [mode] = useState<ScoringMode>(isFinished ? "gameOver" : "entry");

  // For Plan 1, only score entry mode is implemented.
  // Plans 2-4 will add betweenRounds, editing, and gameOver rendering.
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

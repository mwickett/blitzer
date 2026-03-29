"use client";

import { useState } from "react";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
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
    id: string;
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
  rounds,
}: ScoringShellProps) {
  // showEntry is a client override — when user taps "Enter Next Round" we flip to entry.
  // Reset when currentRoundNumber changes (i.e. after a round is submitted + refresh).
  // Uses React's "adjust state during render" pattern to avoid useEffect lint issues.
  const [showEntry, setShowEntry] = useState(false);
  const [prevRound, setPrevRound] = useState(currentRoundNumber);

  if (currentRoundNumber !== prevRound) {
    setPrevRound(currentRoundNumber);
    setShowEntry(false);
  }

  // Derive mode from props + client override
  const mode: ScoringMode = isFinished
    ? "gameOver"
    : rounds.length === 0 || showEntry
      ? "entry"
      : "betweenRounds";

  if (mode === "gameOver") {
    return null;
  }

  if (mode === "betweenRounds") {
    return (
      <BetweenRoundsView
        gameId={gameId}
        players={players}
        rounds={rounds}
        winThreshold={winThreshold}
        nextRoundNumber={currentRoundNumber}
        onEnterScores={() => setShowEntry(true)}
      />
    );
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

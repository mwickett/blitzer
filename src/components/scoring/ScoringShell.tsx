"use client";

import { useState, useEffect, useRef } from "react";
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
  const [showEntry, setShowEntry] = useState(false);
  const prevRoundRef = useRef(currentRoundNumber);

  useEffect(() => {
    if (currentRoundNumber !== prevRoundRef.current) {
      setShowEntry(false);
      prevRoundRef.current = currentRoundNumber;
    }
  }, [currentRoundNumber]);

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
        players={players}
        rounds={rounds}
        winThreshold={winThreshold}
        nextRoundNumber={currentRoundNumber}
        onEnterScores={() => setShowEntry(true)}
        onEditRound={() => {
          // Editing UI deferred to Plan 3
        }}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { type PlayerWithScore } from "./types";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { cloneGame } from "@/server/mutations/games";

export type ScoringMode = "entry" | "betweenRounds" | "gameOver";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
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
  const router = useRouter();

  // showEntry is a client override — when user taps "Enter Next Round" we flip to entry.
  // Reset when currentRoundNumber changes (i.e. after a round is submitted + refresh).
  // Uses React's "adjust state during render" pattern to avoid useEffect lint issues.
  const [showEntry, setShowEntry] = useState(false);
  const [prevRound, setPrevRound] = useState(currentRoundNumber);
  const [hasSeenCelebration, setHasSeenCelebration] = useState(false);
  const [celebrationCancelled, setCelebrationCancelled] = useState(false);

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

  // Compute game stats from rounds data (client-side from serialized props)
  const roundResults: RoundResult[] = rounds.map((round) => {
    const deltas: Record<string, number> = {};
    const blitzCounts: Record<string, number> = {};
    for (const score of round.scores) {
      const pid = score.userId ?? score.guestId ?? "";
      deltas[pid] = calculateRoundScore(score);
      blitzCounts[pid] = score.blitzPileRemaining === 0 ? 1 : 0;
    }
    return { deltas, blitzCounts };
  });
  const playerNameMap = Object.fromEntries(
    players.map((p) => [p.id, p.name])
  );
  const gameStats = calcGameStats(roundResults, playerNameMap);

  // Determine winner (highest score among players)
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  const showCelebration =
    isFinished && !hasSeenCelebration && !celebrationCancelled;

  const handleRematch = async () => {
    const newGameId = await cloneGame(gameId);
    router.push(`/games/${newGameId}`);
  };

  const handleBackToCircle = () => {
    router.push("/games");
  };

  if (mode === "gameOver") {
    return (
      <>
        {showCelebration && winner && (
          <CelebrationOverlay
            winnerName={winner.name}
            winnerScore={winner.score}
            winnerColor={winner.color}
            onComplete={() => setHasSeenCelebration(true)}
            cancelled={celebrationCancelled}
            onCancel={() => setCelebrationCancelled(true)}
          />
        )}
        {winner && (
          <GameOverView
            winner={winner}
            players={players}
            stats={gameStats}
            rounds={rounds}
            onRematch={handleRematch}
            onBackToCircle={handleBackToCircle}
          />
        )}
      </>
    );
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

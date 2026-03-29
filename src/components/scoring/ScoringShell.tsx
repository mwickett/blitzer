"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { RoundEditor } from "./RoundEditor";
import { type PlayerWithScore } from "./types";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { cloneGame } from "@/server/mutations/games";
import { updateRoundScores } from "@/server/mutations/rounds";

export type ScoringMode = "entry" | "betweenRounds" | "gameOver";

interface ScoringShellProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  isFinished: boolean;
  winnerId?: string;
  endedAt?: string;
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
  winnerId,
  endedAt,
  rounds,
}: ScoringShellProps) {
  const router = useRouter();
  const posthog = usePostHog();

  // showEntry is a client override — when user taps "Enter Next Round" we flip to entry.
  // Reset when currentRoundNumber changes (i.e. after a round is submitted + refresh).
  // Uses React's "adjust state during render" pattern to avoid useEffect lint issues.
  const [showEntry, setShowEntry] = useState(false);
  const [prevRound, setPrevRound] = useState(currentRoundNumber);

  // Celebration: only show for recently-finished games (within 30s of endedAt).
  // useState initializer runs once on mount — safe to call Date.now() there.
  const [hasSeenCelebration, setHasSeenCelebration] = useState(() => {
    if (!endedAt) return true;
    return Date.now() - new Date(endedAt).getTime() >= 30_000;
  });

  // Editing state for game over view
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(
    null
  );

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

  // Compute game stats only when rounds/players change (not on every render)
  const gameStats = useMemo(() => {
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
    return calcGameStats(roundResults, playerNameMap);
  }, [rounds, players]);

  // Use server-resolved winnerId (includes tie-breaking) instead of client sort
  const winner = winnerId ? players.find((p) => p.id === winnerId) : undefined;

  const showCelebration = isFinished && !hasSeenCelebration;

  const handleCelebrationComplete = useCallback(() => {
    setHasSeenCelebration(true);
  }, []);

  const handleRematch = async () => {
    const newGameId = await cloneGame(gameId);
    router.push(`/games/${newGameId}`);
  };

  const handleBackToCircle = () => {
    router.push("/games");
  };

  const handleEditRound = useCallback(
    (roundIndex: number) => {
      posthog.capture("scoring_edit_round_tapped", {
        round_number: roundIndex + 1,
      });
      setEditingRoundIndex(roundIndex);
    },
    [posthog]
  );

  const handleSaveEdit = useCallback(
    async (
      updated: Record<
        string,
        { blitzPileRemaining: number; totalCardsPlayed: number }
      >
    ) => {
      if (editingRoundIndex === null) return;
      const round = rounds[editingRoundIndex];

      const scores = players.map((player) => {
        const data = updated[player.id];
        return {
          ...(player.isGuest
            ? { guestId: player.guestId }
            : { userId: player.userId }),
          blitzPileRemaining: data.blitzPileRemaining,
          totalCardsPlayed: data.totalCardsPlayed,
        };
      });

      await updateRoundScores(gameId, round.id, scores);
      posthog.capture("scoring_round_edited", {
        game_id: gameId,
        round_number: editingRoundIndex + 1,
      });
      setEditingRoundIndex(null);
      router.refresh();
    },
    [editingRoundIndex, rounds, players, gameId, posthog, router]
  );

  if (mode === "gameOver") {
    const findPlayerScore = (
      player: PlayerWithScore,
      roundScores: ScoringShellProps["rounds"][0]["scores"]
    ) =>
      roundScores.find(
        (s) =>
          (player.userId && s.userId === player.userId) ||
          (player.guestId && s.guestId === player.guestId)
      );

    return (
      <>
        {showCelebration && winner && (
          <CelebrationOverlay
            winnerName={winner.name}
            winnerScore={winner.score}
            winnerColor={winner.color}
            onComplete={handleCelebrationComplete}
          />
        )}

        {/* Inline round editor for finished games */}
        {editingRoundIndex !== null && (
          <RoundEditor
            roundIndex={editingRoundIndex}
            players={players}
            roundData={Object.fromEntries(
              players.map((p) => {
                const s = findPlayerScore(
                  p,
                  rounds[editingRoundIndex].scores
                );
                return [
                  p.id,
                  {
                    blitzPileRemaining: s?.blitzPileRemaining ?? 0,
                    totalCardsPlayed: s?.totalCardsPlayed ?? 0,
                  },
                ];
              })
            )}
            onSave={handleSaveEdit}
            onCancel={() => setEditingRoundIndex(null)}
          />
        )}

        {winner && (
          <GameOverView
            winner={winner}
            players={players}
            stats={gameStats}
            rounds={rounds}
            onEditRound={handleEditRound}
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

"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { ScoreEntryView } from "./ScoreEntryView";
import { BetweenRoundsView } from "./BetweenRoundsView";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { GameOverView } from "./GameOverView";
import { RoundEditor } from "./RoundEditor";
import { findPlayerScore } from "./utils";
import { useRoundEditing } from "./useRoundEditing";
import { type PlayerWithScore, type RoundData, type RoundScoreData } from "./types";
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
  winnerId?: string;
  endedAt?: string;
  rounds: RoundData[];
  /**
   * When false, render as a read-only spectator view — for people viewing a
   * game outside their circle, or via a public shared link. No score entry,
   * round editing, or rematch.
   */
  canEdit?: boolean;
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
  canEdit = true,
}: ScoringShellProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [, startTransition] = useTransition();

  // showEntry is a client override — when user taps "Enter Next Round" we flip to entry.
  // Reset when currentRoundNumber changes (i.e. after a round is submitted + refresh).
  // Uses React's "adjust state during render" pattern to avoid useEffect lint issues.
  const [showEntry, setShowEntry] = useState(false);
  const [prevRound, setPrevRound] = useState(currentRoundNumber);

  // Optimistic round data — appended after a round is submitted so the UI
  // transitions to betweenRounds immediately without waiting for server refresh.
  const [optimisticRound, setOptimisticRound] = useState<RoundData | null>(null);

  // Celebration: only show for recently-finished games (within 30s of endedAt).
  // useState initializer runs once on mount — safe to call Date.now() there.
  const [hasSeenCelebration, setHasSeenCelebration] = useState(() => {
    if (!endedAt) return true;
    return Date.now() - new Date(endedAt).getTime() >= 30_000;
  });

  // Editing state — shared hook for game-over round editing
  const { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit } =
    useRoundEditing({ gameId, rounds, players });

  if (currentRoundNumber !== prevRound) {
    setPrevRound(currentRoundNumber);
    setShowEntry(false);
    setOptimisticRound(null); // server data caught up — drop the optimistic round
  }

  // Merge optimistic round into rounds and players for downstream components
  const effectiveRounds = useMemo(
    () => (optimisticRound ? [...rounds, optimisticRound] : rounds),
    [rounds, optimisticRound]
  );
  const effectivePlayers = useMemo(() => {
    if (!optimisticRound) return players;
    return players.map((p) => {
      const s = optimisticRound.scores.find(
        (sc) => (sc.userId ?? sc.guestId) === p.id
      );
      if (!s) return p;
      return { ...p, score: p.score + calculateRoundScore(s) };
    });
  }, [players, optimisticRound]);

  const handleRoundSubmitted = useCallback(
    (scoreData: RoundScoreData[]) => {
      setOptimisticRound({ id: `optimistic-${Date.now()}`, scores: scoreData });
      setShowEntry(false);
      startTransition(() => {
        router.replace(`/games/${gameId}`);
      });
    },
    [router, gameId, startTransition]
  );

  // Derive mode from props + client override. Spectators (!canEdit) never see
  // the score-entry form — they only ever observe betweenRounds / gameOver.
  const mode: ScoringMode = isFinished
    ? "gameOver"
    : canEdit && ((rounds.length === 0 && !optimisticRound) || showEntry)
      ? "entry"
      : "betweenRounds";

  // Compute game stats only when rounds/players change (not on every render)
  const gameStats = useMemo(() => {
    const roundResults: RoundResult[] = effectiveRounds.map((round) => {
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
  }, [effectiveRounds, players]);

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

  // A spectator on a game that hasn't started yet has nothing to observe —
  // the graph/standings views assume at least one round of data.
  if (!canEdit && !isFinished && effectiveRounds.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-[#8b5e3c]">
        This game hasn&rsquo;t started yet.
      </div>
    );
  }

  if (mode === "gameOver") {
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

        {editError && (
          <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
            {editError}
          </div>
        )}

        {/* Inline round editor for finished games — members only */}
        {canEdit && editingRoundIndex !== null && editingRoundIndex < effectiveRounds.length && (
          <RoundEditor
            roundIndex={editingRoundIndex}
            players={players}
            roundData={Object.fromEntries(
              players.map((p) => {
                const s = findPlayerScore(
                  p,
                  effectiveRounds[editingRoundIndex].scores
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
            onCancel={cancelEdit}
          />
        )}

        {winner && (
          <GameOverView
            winner={winner}
            players={effectivePlayers}
            stats={gameStats}
            rounds={effectiveRounds}
            onEditRound={canEdit ? handleEditRound : undefined}
            onRematch={handleRematch}
            onBackToCircle={handleBackToCircle}
            canEdit={canEdit}
          />
        )}
      </>
    );
  }

  if (mode === "betweenRounds") {
    return (
      <BetweenRoundsView
        gameId={gameId}
        players={effectivePlayers}
        rounds={effectiveRounds}
        winThreshold={winThreshold}
        nextRoundNumber={optimisticRound ? currentRoundNumber + 1 : currentRoundNumber}
        onEnterScores={() => setShowEntry(true)}
        canEdit={canEdit}
      />
    );
  }

  return (
    <ScoreEntryView
      gameId={gameId}
      currentRoundNumber={currentRoundNumber}
      players={players}
      winThreshold={winThreshold}
      onRoundSubmitted={handleRoundSubmitted}
    />
  );
}

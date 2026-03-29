// src/components/scoring/ScoreEntryView.tsx
"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { FloatingCTA } from "./FloatingCTA";
import { RoundHeader } from "./RoundHeader";
import { RaceTrack } from "./RaceTrack";
import { UndoToast } from "./UndoToast";
import { type PlayerEntry, type PlayerWithScore, getEntryStatus } from "./types";
import { usePostHog } from "posthog-js/react";
import { validateGameRules, calculateRoundScore } from "@/lib/validation/gameRules";
import { createRoundForGame, deleteLatestRound } from "@/server/mutations";

interface ScoreEntryViewProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
}

export function ScoreEntryView({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
}: ScoreEntryViewProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>(() =>
    Object.fromEntries(
      players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
    )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoData, setUndoData] = useState<{
    roundNumber: number;
    preSubmitEntries: Record<string, PlayerEntry>;
    serverConfirmed: boolean;
  } | null>(null);
  const [optimisticDeltas, setOptimisticDeltas] = useState<Record<string, number> | null>(null);
  const deltaTimerRef = useRef<NodeJS.Timeout | null>(null);

  const allComplete = useMemo(
    () => Object.values(entries).every((e) => getEntryStatus(e) === "complete"),
    [entries]
  );

  const remainingCount = useMemo(
    () =>
      Object.values(entries).filter((e) => getEntryStatus(e) !== "complete")
        .length,
    [entries]
  );

  const handleUpdate = useCallback(
    (playerId: string, field: "blitzRemaining" | "cardsPlayed", value: number | null) => {
      setEntries((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], [field]: value },
      }));
      setError(null);
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!allComplete || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const scores = players.map((player) => {
      const entry = entries[player.id];
      return {
        ...(player.isGuest
          ? { guestId: player.guestId }
          : { userId: player.userId }),
        blitzPileRemaining: entry.blitzRemaining ?? 0,
        totalCardsPlayed: entry.cardsPlayed ?? 0,
      };
    });

    // Save pre-submit state for undo
    const preSubmitEntries = { ...entries };

    try {
      validateGameRules(scores);
      // Calculate deltas for flash animation
      const deltas: Record<string, number> = {};
      for (const player of players) {
        const entry = entries[player.id];
        deltas[player.id] = calculateRoundScore({
          blitzPileRemaining: entry.blitzRemaining ?? 0,
          totalCardsPlayed: entry.cardsPlayed ?? 0,
        });
      }
      setOptimisticDeltas(deltas);
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
      deltaTimerRef.current = setTimeout(() => setOptimisticDeltas(null), 1200);

      // Show undo toast optimistically
      setUndoData({ roundNumber: currentRoundNumber, preSubmitEntries, serverConfirmed: false });
      setEntries(
        Object.fromEntries(
          players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
        )
      );

      await createRoundForGame(gameId, currentRoundNumber, scores);
      // Mark server-confirmed so undo knows to call deleteLatestRound
      // Don't router.refresh() here — that would unmount this component (ScoringShell
      // flips to betweenRounds mode when round number changes), killing the undo toast.
      // Refresh is deferred to onDismiss/onUndo.
      setUndoData((prev) => prev ? { ...prev, serverConfirmed: true } : null);
      posthog.capture("scoring_round_submitted", {
        game_id: gameId,
        round_number: currentRoundNumber,
        player_count: players.length,
      });
      setIsSubmitting(false);
    } catch (e) {
      // Revert optimistic update
      setEntries(preSubmitEntries);
      setUndoData(null);
      setOptimisticDeltas(null);
      setError(e instanceof Error ? e.message : "Failed to submit round");
      setIsSubmitting(false);
    }
  }, [allComplete, isSubmitting, players, entries, gameId, currentRoundNumber, router, posthog]);

  const handleUndo = useCallback(async () => {
    if (!undoData) return;
    const wasConfirmed = undoData.serverConfirmed;
    const savedEntries = undoData.preSubmitEntries;

    // Immediately revert local state
    posthog.capture("scoring_round_undone", {
      game_id: gameId,
      round_number: undoData.roundNumber,
    });
    setUndoData(null);
    setOptimisticDeltas(null);
    setEntries(savedEntries);

    if (wasConfirmed) {
      try {
        await deleteLatestRound(gameId);
      } catch {
        setError("Failed to undo. Please refresh the page.");
      }
    }

    router.refresh();
  }, [undoData, gameId, router, posthog]);

  return (
    <div className="pb-4">
      <RoundHeader
        title={`Round ${currentRoundNumber}`}
        subtitle={`First to ${winThreshold} wins`}
      />

      {/* Race Track */}
      <div className="px-5 pt-2 pb-2">
        <RaceTrack players={players} winThreshold={winThreshold} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg flex items-center justify-between">
          <span className="text-sm text-[#b91c1c]">{error}</span>
          <button
            onClick={handleSubmit}
            className="text-sm font-bold text-[#b91c1c] ml-2 underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Player cards */}
      <div className="px-4 pt-2 pb-2 space-y-2.5 max-w-[540px]">
        {players.map((player) => (
          <ScoreEntryCard
            key={player.id}
            name={player.name}
            color={player.color}
            score={player.score}
            entry={entries[player.id]}
            status={getEntryStatus(entries[player.id])}
            onUpdate={(field, value) => handleUpdate(player.id, field, value)}
            deltaFlash={optimisticDeltas?.[player.id] ?? null}
          />
        ))}
      </div>

      {/* Sticky CTA — stays at bottom of viewport but won't overlap footer */}
      <FloatingCTA
        state={{
          mode: "submit",
          remainingCount,
          allComplete: allComplete && !isSubmitting,
        }}
        onAction={handleSubmit}
      />

      {/* Undo toast */}
      {undoData && (
        <UndoToast
          roundNumber={undoData.roundNumber}
          onUndo={handleUndo}
          onDismiss={() => {
            setUndoData(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

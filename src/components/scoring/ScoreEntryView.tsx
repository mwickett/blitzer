// src/components/scoring/ScoreEntryView.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { FloatingCTA } from "./FloatingCTA";
import { RoundHeader } from "./RoundHeader";
import { type PlayerEntry, type PlayerWithScore, getEntryStatus } from "./types";
import { validateGameRules } from "@/lib/validation/gameRules";
import { createRoundForGame } from "@/server/mutations";

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
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>(() =>
    Object.fromEntries(
      players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
    )
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      validateGameRules(scores);
      await createRoundForGame(gameId, currentRoundNumber, scores);
      // Clear local state before refresh — App Router preserves client state across refresh
      setEntries(
        Object.fromEntries(
          players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }])
        )
      );
      setIsSubmitting(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit round");
      setIsSubmitting(false);
    }
  }, [allComplete, isSubmitting, players, entries, gameId, currentRoundNumber, router]);

  return (
    <div className="pb-4">
      <RoundHeader
        title={`Round ${currentRoundNumber}`}
        subtitle={`First to ${winThreshold} wins`}
      />

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
          {error}
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
    </div>
  );
}

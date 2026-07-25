// src/components/scoring/ScoreEntryView.tsx
"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ScoreEntryCard } from "./ScoreEntryCard";
import { FloatingCTA } from "./FloatingCTA";
import { RoundHeader } from "./RoundHeader";
import { RaceTrack } from "./RaceTrack";
import {
  type PlayerEntry,
  type PlayerWithScore,
  type RoundScoreData,
  getEntryStatus,
} from "./types";
import { usePostHog } from "posthog-js/react";
import {
  validateGameRules,
  calculateRoundScore,
} from "@/lib/validation/gameRules";
import { createRoundForGame } from "@/server/mutations";

interface ScoreEntryViewProps {
  gameId: string;
  currentRoundNumber: number;
  players: PlayerWithScore[];
  winThreshold: number;
  onRoundSubmitted?: (scores: RoundScoreData[]) => void;
}

export function ScoreEntryView({
  gameId,
  currentRoundNumber,
  players,
  winThreshold,
  onRoundSubmitted,
}: ScoreEntryViewProps) {
  const router = useRouter();
  const posthog = usePostHog();
  const [isPending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Record<string, PlayerEntry>>(() =>
    Object.fromEntries(
      players.map((p) => [p.id, { blitzRemaining: null, cardsPlayed: null }]),
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticDeltas, setOptimisticDeltas] = useState<Record<
    string,
    number
  > | null>(null);
  const deltaTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up delta flash timer on unmount
  useEffect(() => {
    return () => {
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    };
  }, []);

  const remainingCount = useMemo(
    () =>
      Object.values(entries).filter((e) => getEntryStatus(e) !== "complete")
        .length,
    [entries],
  );
  const allComplete = remainingCount === 0;

  const handleUpdate = useCallback(
    (
      playerId: string,
      field: "blitzRemaining" | "cardsPlayed",
      value: number | null,
    ) => {
      setEntries((prev) => ({
        ...prev,
        [playerId]: { ...prev[playerId], [field]: value },
      }));
      setError(null);
    },
    [],
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

    const preSubmitEntries = { ...entries };

    try {
      validateGameRules(scores);

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

      setEntries(
        Object.fromEntries(
          players.map((p) => [
            p.id,
            { blitzRemaining: null, cardsPlayed: null },
          ]),
        ),
      );

      const result = await createRoundForGame(
        gameId,
        currentRoundNumber,
        scores,
      );
      if (!result.ok) {
        // Another device recorded this round first — keep what was typed on
        // screen so it can be re-entered against the refreshed round.
        setEntries(preSubmitEntries);
        setOptimisticDeltas(null);
        setError(result.message);
        setIsSubmitting(false);
        return;
      }
      posthog.capture("scoring_round_submitted", {
        game_id: gameId,
        round_number: currentRoundNumber,
        player_count: players.length,
      });
      setIsSubmitting(false);

      if (onRoundSubmitted) {
        // Let ScoringShell handle the optimistic transition + navigation
        const roundScoreData: RoundScoreData[] = scores.map((s) => ({
          userId: "userId" in s ? s.userId : undefined,
          guestId: "guestId" in s ? s.guestId : undefined,
          blitzPileRemaining: s.blitzPileRemaining,
          totalCardsPlayed: s.totalCardsPlayed,
        }));
        onRoundSubmitted(roundScoreData);
      } else {
        // Fallback: navigate directly
        // router.replace to the current URL (not router.refresh) — forces
        // Next.js to rebuild its internal route state, which can be stale
        // after the /games/new?step=colors → /games/[id] transition that
        // uses window.history.replaceState. Using router.refresh here
        // would refresh the stale pre-replaceState route and navigate
        // the user back to the colors step.
        // See docs/solutions/ui-bugs/nextjs-router-replace-history-cross-route.md
        startTransition(() => {
          router.replace(`/games/${gameId}`);
        });
      }
    } catch (e) {
      setEntries(preSubmitEntries);
      setOptimisticDeltas(null);
      setError(e instanceof Error ? e.message : "Failed to submit round");
      setIsSubmitting(false);
    }
  }, [
    allComplete,
    isSubmitting,
    players,
    entries,
    gameId,
    currentRoundNumber,
    posthog,
    router,
    onRoundSubmitted,
  ]);

  return (
    <div className="pb-4">
      <RoundHeader
        title={`Round ${currentRoundNumber}`}
        subtitle={`First to ${winThreshold} wins`}
      />

      {/* Race Track */}
      <div className="px-4 pt-2 pb-2">
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
          allComplete: allComplete && !isSubmitting && !isPending,
        }}
        onAction={handleSubmit}
      />
    </div>
  );
}

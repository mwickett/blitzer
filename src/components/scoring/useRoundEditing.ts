// src/components/scoring/useRoundEditing.ts
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { updateRoundScores } from "@/server/mutations/rounds";
import { type PlayerWithScore, type RoundData } from "./types";

interface UseRoundEditingParams {
  gameId: string;
  rounds: RoundData[];
  players: PlayerWithScore[];
}

export function useRoundEditing({ gameId, rounds, players }: UseRoundEditingParams) {
  const router = useRouter();
  const posthog = usePostHog();
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditRound = useCallback((roundIndex: number) => {
    posthog.capture("scoring_edit_round_tapped", { round_number: roundIndex + 1 });
    setEditError(null);
    setEditingRoundIndex(roundIndex);
  }, [posthog]);

  const handleSaveEdit = useCallback(async (
    updated: Record<string, { blitzPileRemaining: number; totalCardsPlayed: number }>
  ) => {
    if (editingRoundIndex === null || editingRoundIndex >= rounds.length) return;
    const round = rounds[editingRoundIndex];
    setEditError(null);

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

    try {
      await updateRoundScores(gameId, round.id, scores);
      posthog.capture("scoring_round_edited", {
        game_id: gameId,
        round_number: editingRoundIndex + 1,
      });
      setEditingRoundIndex(null);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save changes");
    }
  }, [editingRoundIndex, rounds, players, gameId, posthog, router]);

  const cancelEdit = useCallback(() => {
    setEditingRoundIndex(null);
    setEditError(null);
  }, []);

  return { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit };
}

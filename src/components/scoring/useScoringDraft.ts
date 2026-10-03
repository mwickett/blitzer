"use client";

import { useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import {
  createRoundForGame,
  updateRoundScores,
} from "@/server/mutations/rounds";
import { submittedScoresSchema } from "@/lib/validation/submissions";
import { findPlayerScore } from "./utils";
import {
  type PlayerEntry,
  type PlayerWithScore,
  type RoundData,
} from "./types";

export interface ScoringDraft {
  roundNumber: number;
  players: PlayerWithScore[];
  entries: Record<string, PlayerEntry>;
  /** Absent for a new round; edits retain the snapshot they were opened from. */
  round?: RoundData;
}

export function newRoundDraft(
  players: PlayerWithScore[],
  roundNumber: number,
): ScoringDraft {
  return {
    players,
    roundNumber,
    entries: Object.fromEntries(
      players.map((player) => [
        player.id,
        { blitzRemaining: null, cardsPlayed: null },
      ]),
    ),
  };
}

export function useScoringDraft(
  gameId: string,
  initialDraft: () => ScoringDraft | null,
  onSaved: (round: RoundData) => void,
) {
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const saving = useRef(false);
  // Measures entry effort, not round length: starts at the first value typed.
  const firstEntryAt = useRef<number | null>(null);
  const posthog = usePostHog();

  const track = (event: string, properties: Record<string, unknown>) => {
    try {
      posthog.capture(event, properties);
    } catch {
      // Optional telemetry must never change scoring behavior.
    }
  };

  const open = (next: ScoringDraft) => {
    if (saving.current) return;
    // A second tap on an open round must not adopt a refreshed revision while
    // keeping the old values. Reconciliation is an explicit separate action.
    if (draft?.round && draft.round.id === next.round?.id) return;
    setDraft(next);
    setError(null);
    setHasConflict(false);
    firstEntryAt.current = null;
  };
  const edit = (
    players: PlayerWithScore[],
    round: RoundData,
    roundNumber: number,
  ) =>
    open({
      players,
      round,
      roundNumber,
      entries: Object.fromEntries(
        players.map((player) => {
          const score = findPlayerScore(player, round.scores);
          return [
            player.id,
            {
              blitzRemaining: score?.blitzPileRemaining ?? null,
              cardsPlayed: score?.totalCardsPlayed ?? null,
            },
          ];
        }),
      ),
    });
  const update = (
    playerId: string,
    field: keyof PlayerEntry,
    value: number | null,
  ) => {
    if (saving.current) return;
    firstEntryAt.current ??= Date.now();
    setDraft(
      (current) =>
        current && {
          ...current,
          entries: {
            ...current.entries,
            [playerId]: { ...current.entries[playerId], [field]: value },
          },
        },
    );
    if (!hasConflict) setError(null);
  };
  const cancel = () => {
    if (saving.current) return;
    if (draft?.round) {
      track("scoring_round_edit_cancelled", {
        game_id: gameId,
        round_number: draft.roundNumber,
        had_conflict: hasConflict,
      });
    }
    firstEntryAt.current = null;
    setDraft(null);
    setError(null);
    setHasConflict(false);
  };
  const reconcile = (round: RoundData) => {
    if (saving.current || !draft) return;
    setDraft({ ...draft, round });
    setError(null);
    setHasConflict(false);
  };
  const submit = async () => {
    if (!draft || saving.current || hasConflict) return;
    const scores = draft.players.map((player) => ({
      ...(player.isGuest
        ? { guestId: player.guestId }
        : { userId: player.userId }),
      blitzPileRemaining: draft.entries[player.id].blitzRemaining,
      totalCardsPlayed: draft.entries[player.id].cardsPlayed,
    }));
    const parsed = submittedScoresSchema.safeParse(scores);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      const result = draft.round
        ? await updateRoundScores(
            gameId,
            draft.round.id,
            parsed.data,
            draft.round.revision,
          )
        : await createRoundForGame(gameId, draft.roundNumber, parsed.data);
      if (!result.ok) {
        setError(result.message);
        setHasConflict(result.reason !== "invalid_input");
        if (result.reason !== "invalid_input") {
          track("scoring_round_conflict", {
            game_id: gameId,
            round_number: draft.roundNumber,
            is_edit: Boolean(draft.round),
            reason: result.reason,
          });
        }
        return;
      }
      const entryDurationMs =
        firstEntryAt.current === null
          ? null
          : Date.now() - firstEntryAt.current;
      firstEntryAt.current = null;
      setDraft(null);
      onSaved(result.round);
      track(draft.round ? "scoring_round_edited" : "scoring_round_submitted", {
        game_id: gameId,
        round_number: draft.roundNumber,
        player_count: draft.players.length,
        entry_duration_ms: entryDurationMs,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save scores. Please try again.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return {
    draft,
    isSaving,
    error,
    hasConflict,
    open,
    edit,
    update,
    cancel,
    reconcile,
    submit,
  };
}

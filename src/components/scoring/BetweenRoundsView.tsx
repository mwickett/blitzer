"use client";

import { useMemo } from "react";
import { usePostHog } from "posthog-js/react";
import { RaceTrack } from "./RaceTrack";
import { Standings } from "./Standings";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { RoundEditor } from "./RoundEditor";
import { FloatingCTA } from "./FloatingCTA";
import { GraphCarousel } from "./GraphCarousel";
import { ScoreProgressionCard } from "./graphs/ScoreProgressionCard";
import { HotColdCard } from "./graphs/HotColdCard";
import { WinProbabilityCard } from "./graphs/WinProbabilityCard";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { useRoundEditing } from "./useRoundEditing";
import { findPlayerScore } from "./utils";
import { type PlayerWithScore, type RoundData } from "./types";

interface BetweenRoundsViewProps {
  gameId: string;
  players: PlayerWithScore[];
  rounds: RoundData[];
  winThreshold: number;
  nextRoundNumber: number;
  onEnterScores: () => void;
  /** When false, render as a read-only spectator view (no entry/edit actions) */
  canEdit?: boolean;
}

export function BetweenRoundsView({
  gameId,
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
  canEdit = true,
}: BetweenRoundsViewProps) {
  const posthog = usePostHog();
  const { editingRoundIndex, editError, handleEditRound, handleSaveEdit, cancelEdit } =
    useRoundEditing({ gameId, rounds, players });

  const handleEnterScores = () => {
    posthog.capture("scoring_enter_next_round", { round_number: nextRoundNumber });
    onEnterScores();
  };

  // Compute derived graph data from rounds
  const { scoresByRound, deltasByRound } = useMemo(() => {
    const scores: Record<string, number[]> = {};
    const deltas: Record<string, number[]> = {};

    for (const player of players) {
      scores[player.id] = [];
      deltas[player.id] = [];
      let cumulative = 0;

      for (const round of rounds) {
        const s = findPlayerScore(player, round.scores);
        const delta = s ? calculateRoundScore(s) : 0;
        cumulative += delta;
        scores[player.id].push(cumulative);
        deltas[player.id].push(delta);
      }
    }

    return { scoresByRound: scores, deltasByRound: deltas };
  }, [players, rounds]);

  return (
    <>
      {/* Race Track */}
      <div className="px-4 pt-4 pb-2">
        <RaceTrack players={players} winThreshold={winThreshold} />
      </div>

      {/* Graph carousel */}
      <GraphCarousel>
        <ScoreProgressionCard
          players={players}
          scoresByRound={scoresByRound}
          winThreshold={winThreshold}
        />
        <HotColdCard players={players} deltasByRound={deltasByRound} />
        <WinProbabilityCard
          players={players}
          roundsPlayed={rounds.length}
          winThreshold={winThreshold}
          deltasByPlayer={deltasByRound}
        />
      </GraphCarousel>

      {/* Standings */}
      <div className="pt-2 pb-2">
        <Standings players={players} winThreshold={winThreshold} />
      </div>

      {/* Edit error banner */}
      {editError && (
        <div className="mx-4 mb-2 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-sm text-[#b91c1c]">
          {editError}
        </div>
      )}

      {/* Round editor (inline) — members only */}
      {canEdit && editingRoundIndex !== null && editingRoundIndex < rounds.length && (
        <RoundEditor
          roundIndex={editingRoundIndex}
          players={players}
          roundData={Object.fromEntries(
            players.map((p) => {
              const s = findPlayerScore(p, rounds[editingRoundIndex].scores);
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

      {/* Round history table — edit affordance is members only */}
      <div className="pt-2 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          onEditRound={canEdit ? handleEditRound : undefined}
        />
      </div>

      {/* Floating CTA + its spacer — members only */}
      {canEdit && (
        <>
          <div className="h-28" />
          <FloatingCTA
            state={{ mode: "nextRound", roundNumber: nextRoundNumber }}
            onAction={handleEnterScores}
          />
        </>
      )}
    </>
  );
}

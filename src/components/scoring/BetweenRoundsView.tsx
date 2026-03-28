"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { RaceTrack } from "./RaceTrack";
import { Standings } from "./Standings";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { FloatingCTA } from "./FloatingCTA";
import { type PlayerWithScore } from "./types";

interface BetweenRoundsViewProps {
  players: PlayerWithScore[];
  rounds: {
    scores: {
      userId?: string | null;
      guestId?: string | null;
      blitzPileRemaining: number;
      totalCardsPlayed: number;
    }[];
  }[];
  winThreshold: number;
  nextRoundNumber: number;
  onEnterScores: () => void;
  onEditRound: (roundIndex: number) => void;
}

export function BetweenRoundsView({
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
  onEditRound,
}: BetweenRoundsViewProps) {
  const posthog = usePostHog();
  const [editingRound, setEditingRound] = useState<number | null>(null);

  const handleEnterScores = () => {
    posthog.capture("scoring_enter_next_round", { round_number: nextRoundNumber });
    onEnterScores();
  };

  const handleEditRound = (roundIndex: number) => {
    posthog.capture("scoring_edit_round_tapped", { round_number: roundIndex + 1 });
    setEditingRound(roundIndex);
    onEditRound(roundIndex);
  };

  return (
    <>
      {/* Race Track */}
      <div className="px-5 pt-4 pb-2">
        <RaceTrack players={players} winThreshold={winThreshold} />
      </div>

      {/* Graph carousel placeholder — will be added in Plan 3 */}

      {/* Standings */}
      <div className="pt-2 pb-2">
        <Standings players={players} winThreshold={winThreshold} />
      </div>

      {/* Round history table */}
      <div className="pt-2 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          editingRound={editingRound}
          onEditRound={handleEditRound}
        />
      </div>

      {/* Bottom spacer for floating CTA */}
      <div className="h-20" />

      {/* Floating CTA */}
      <FloatingCTA
        state={{ mode: "nextRound", roundNumber: nextRoundNumber }}
        onAction={handleEnterScores}
      />
    </>
  );
}

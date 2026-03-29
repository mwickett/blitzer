"use client";

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
}

export function BetweenRoundsView({
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
}: BetweenRoundsViewProps) {
  const posthog = usePostHog();

  const handleEnterScores = () => {
    posthog.capture("scoring_enter_next_round", { round_number: nextRoundNumber });
    onEnterScores();
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

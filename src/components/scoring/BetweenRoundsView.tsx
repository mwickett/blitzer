"use client";

import { useMemo } from "react";
import { usePostHog } from "posthog-js/react";
import { RaceTrack } from "./RaceTrack";
import { Standings } from "./Standings";
import { RoundHistoryTable } from "./RoundHistoryTable";
import { FloatingCTA } from "./FloatingCTA";
import { GraphCarousel } from "./GraphCarousel";
import { ScoreProgressionCard } from "./graphs/ScoreProgressionCard";
import { HotColdCard } from "./graphs/HotColdCard";
import { WinProbabilityCard } from "./graphs/WinProbabilityCard";
import { RoundMvpsCard } from "./graphs/RoundMvpsCard";
import { BlitzPileCard } from "./graphs/BlitzPileCard";
import { buildRoundGraphSeries } from "./roundGraphSeries";
import { RoundRecap } from "./RoundRecap";
import { type PlayerWithScore, type RoundData } from "./types";
import { type PredictionProfilesByPlayer } from "@/lib/scoring/probability";

interface BetweenRoundsViewProps {
  /** Set only when the spoken round recap is enabled for this viewer. */
  recapGameId?: string;
  players: PlayerWithScore[];
  rounds: RoundData[];
  winThreshold: number;
  nextRoundNumber: number;
  onEnterScores: () => void;
  onEditRound?: (roundIndex: number) => void;
  disabled?: boolean;
  showNextRound?: boolean;
  /** When false, render as a read-only spectator view (no entry/edit actions) */
  canEdit?: boolean;
  predictionProfiles?: PredictionProfilesByPlayer;
}

export function BetweenRoundsView({
  recapGameId,
  players,
  rounds,
  winThreshold,
  nextRoundNumber,
  onEnterScores,
  onEditRound,
  disabled = false,
  showNextRound = true,
  canEdit = true,
  predictionProfiles,
}: BetweenRoundsViewProps) {
  const posthog = usePostHog();

  const handleEnterScores = () => {
    try {
      posthog.capture("scoring_enter_next_round", {
        round_number: nextRoundNumber,
      });
    } catch {
      // Optional analytics must not prevent score entry.
    }
    onEnterScores();
  };

  // Any new or corrected round makes an earlier recap stale.
  const recapKey = rounds.map((round) => `${round.id}:${round.revision}`).join(",");

  const {
    scoresByRound,
    deltasByRound,
    roundSamplesByPlayer,
    blitzByRound,
    scoredByRound,
  } = useMemo(() => buildRoundGraphSeries(players, rounds), [players, rounds]);

  return (
    <>
      {/* Race Track */}
      <div className="px-4 pt-4 pb-2">
        <RaceTrack players={players} winThreshold={winThreshold} />
      </div>

      {/* Graph carousel */}
      <GraphCarousel
        context="between_rounds"
        graphNames={[
          "score_progression",
          "hot_cold",
          "round_mvps",
          "blitz_pile",
          "win_probability",
        ]}
      >
        <ScoreProgressionCard
          players={players}
          scoresByRound={scoresByRound}
          winThreshold={winThreshold}
        />
        <HotColdCard players={players} deltasByRound={deltasByRound} />
        <RoundMvpsCard
          players={players}
          deltasByRound={deltasByRound}
          scoredByRound={scoredByRound}
        />
        <BlitzPileCard players={players} blitzByRound={blitzByRound} />
        <WinProbabilityCard
          players={players}
          roundsPlayed={rounds.length}
          winThreshold={winThreshold}
          deltasByPlayer={deltasByRound}
          predictionProfiles={predictionProfiles}
          roundSamplesByPlayer={roundSamplesByPlayer}
        />
      </GraphCarousel>

      {recapGameId && canEdit && (
        <RoundRecap key={recapKey} gameId={recapGameId} roundsPlayed={rounds.length} />
      )}

      {/* Standings */}
      <div className="pt-2 pb-2">
        <Standings players={players} winThreshold={winThreshold} />
      </div>

      {/* Round history table — edit affordance is members only */}
      <div className="pt-2 pb-2">
        <RoundHistoryTable
          players={players}
          rounds={rounds}
          onEditRound={canEdit ? onEditRound : undefined}
          disabled={disabled}
        />
      </div>

      {/* Floating CTA + its spacer — members only */}
      {canEdit && showNextRound && (
        <>
          <div className="h-28" />
          <FloatingCTA
            state={{ mode: "nextRound", roundNumber: nextRoundNumber }}
            onAction={handleEnterScores}
            disabled={disabled}
          />
        </>
      )}
    </>
  );
}

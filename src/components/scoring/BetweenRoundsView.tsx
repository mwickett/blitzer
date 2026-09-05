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
import { calculateRoundScore } from "@/lib/validation/gameRules";
import { findPlayerScore } from "./utils";
import { type PlayerWithScore, type RoundData } from "./types";
import {
  type ForecastRoundSample,
  type PredictionProfilesByPlayer,
} from "@/lib/scoring/probability";

interface BetweenRoundsViewProps {
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

  // Compute derived graph data from rounds
  const { scoresByRound, deltasByRound, roundSamplesByPlayer } = useMemo(() => {
    const scores: Record<string, number[]> = {};
    const deltas: Record<string, number[]> = {};
    const samples: Record<string, ForecastRoundSample[]> = {};

    for (const player of players) {
      scores[player.id] = [];
      deltas[player.id] = [];
      samples[player.id] = [];
      let cumulative = 0;

      for (const round of rounds) {
        const s = findPlayerScore(player, round.scores);
        const delta = s ? calculateRoundScore(s) : 0;
        cumulative += delta;
        scores[player.id].push(cumulative);
        deltas[player.id].push(delta);
        if (s) {
          samples[player.id].push({
            totalCardsPlayed: s.totalCardsPlayed,
            blitzPileRemaining: s.blitzPileRemaining,
          });
        }
      }
    }

    return {
      scoresByRound: scores,
      deltasByRound: deltas,
      roundSamplesByPlayer: samples,
    };
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
          predictionProfiles={predictionProfiles}
          roundSamplesByPlayer={roundSamplesByPlayer}
        />
      </GraphCarousel>

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

import { calculateRoundScore } from "@/lib/validation/gameRules";
import { type ForecastRoundSample } from "@/lib/scoring/probability";
import { findPlayerScore } from "./utils";
import { type PlayerWithScore, type RoundData } from "./types";

/**
 * Cumulative scores, per-round deltas, and forecast samples from saved rounds.
 * Shared by between-rounds and finished-game graph UIs.
 */
export function buildRoundGraphSeries(
  players: PlayerWithScore[],
  rounds: RoundData[],
): {
  scoresByRound: Record<string, number[]>;
  deltasByRound: Record<string, number[]>;
  roundSamplesByPlayer: Record<string, ForecastRoundSample[]>;
} {
  const scoresByRound: Record<string, number[]> = {};
  const deltasByRound: Record<string, number[]> = {};
  const roundSamplesByPlayer: Record<string, ForecastRoundSample[]> = {};

  for (const player of players) {
    scoresByRound[player.id] = [];
    deltasByRound[player.id] = [];
    roundSamplesByPlayer[player.id] = [];
    let cumulative = 0;

    for (const round of rounds) {
      const s = findPlayerScore(player, round.scores);
      const delta = s ? calculateRoundScore(s) : 0;
      cumulative += delta;
      scoresByRound[player.id].push(cumulative);
      deltasByRound[player.id].push(delta);
      if (s) {
        roundSamplesByPlayer[player.id].push({
          totalCardsPlayed: s.totalCardsPlayed,
          blitzPileRemaining: s.blitzPileRemaining,
        });
      }
    }
  }

  return { scoresByRound, deltasByRound, roundSamplesByPlayer };
}

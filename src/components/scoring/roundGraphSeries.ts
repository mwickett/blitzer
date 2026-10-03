import { calculateRoundScore, hasBreakdown } from "@/lib/validation/gameRules";
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
  /**
   * Blitz pile left per round; null where the player has no saved score or
   * the round total was typed, so breakdown-based graphs skip it.
   */
  blitzByRound: Record<string, (number | null)[]>;
  /** Whether the player has a saved score (breakdown or typed) per round. */
  scoredByRound: Record<string, boolean[]>;
} {
  const scoresByRound: Record<string, number[]> = {};
  const deltasByRound: Record<string, number[]> = {};
  const roundSamplesByPlayer: Record<string, ForecastRoundSample[]> = {};
  const blitzByRound: Record<string, (number | null)[]> = {};
  const scoredByRound: Record<string, boolean[]> = {};

  for (const player of players) {
    scoresByRound[player.id] = [];
    deltasByRound[player.id] = [];
    roundSamplesByPlayer[player.id] = [];
    blitzByRound[player.id] = [];
    scoredByRound[player.id] = [];
    let cumulative = 0;

    for (const round of rounds) {
      const s = findPlayerScore(player, round.scores);
      const delta = s ? calculateRoundScore(s) : 0;
      cumulative += delta;
      scoresByRound[player.id].push(cumulative);
      deltasByRound[player.id].push(delta);
      blitzByRound[player.id].push(s ? s.blitzPileRemaining : null);
      scoredByRound[player.id].push(Boolean(s));
      // Forecast mechanics model cards and Blitz piles; typed totals still
      // feed the forecast through deltasByRound.
      if (s && hasBreakdown(s)) {
        roundSamplesByPlayer[player.id].push({
          totalCardsPlayed: s.totalCardsPlayed,
          blitzPileRemaining: s.blitzPileRemaining,
        });
      }
    }
  }

  return {
    scoresByRound,
    deltasByRound,
    roundSamplesByPlayer,
    blitzByRound,
    scoredByRound,
  };
}

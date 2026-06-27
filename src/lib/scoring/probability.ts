const SIMULATION_COUNT = 10_000;
const MAX_FUTURE_ROUNDS = 50;
const UNRESOLVED_OUTCOME_ID = "__unresolved";
export const MIN_SIMULATED_ROUND_SCORE = -20;
export const MAX_SIMULATED_ROUND_SCORE = 40;

// Seeded PRNG (xoshiro128**) for deterministic Monte Carlo results.
// Ensures identical inputs always produce identical probabilities,
// which prevents the UI from flickering between renders.
function makeRng(seed: number) {
  let s0 = seed >>> 0 || 1;
  let s1 = (seed * 2654435761) >>> 0 || 1;
  let s2 = (seed * 2246822519) >>> 0 || 1;
  let s3 = (seed * 3266489917) >>> 0 || 1;
  return () => {
    const t = (s1 << 9) >>> 0;
    let r = (s1 * 5) >>> 0;
    r = (((r << 7) | (r >>> 25)) * 9) >>> 0;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;
    return (r >>> 0) / 4294967296;
  };
}

// Box-Muller transform: convert two uniform randoms into a normal sample
function normalSample(mean: number, std: number, rng: () => number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

export function clampRoundScore(score: number): number {
  return Math.max(
    MIN_SIMULATED_ROUND_SCORE,
    Math.min(MAX_SIMULATED_ROUND_SCORE, Math.round(score))
  );
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

interface PlayerStats {
  id: string;
  currentScore: number;
  mean: number;
  std: number;
}

export interface ForecastRange {
  p25: number;
  median: number;
  p75: number;
}

export type ForecastConfidence = "low" | "medium" | "high";

export interface PlayerForecast {
  id: string;
  winProbability: number;
  nextRoundWinProbability: number;
  winningRound: ForecastRange | null;
}

export interface RaceForecast {
  players: Record<string, PlayerForecast>;
  gameEndRound: ForecastRange | null;
  unresolvedProbability: number;
  confidence: ForecastConfidence;
  simulationCount: number;
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return Infinity;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * percentileValue))
  );
  return sortedValues[index];
}

function buildRange(values: number[]): ForecastRange | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
  };
}

function toPercent(count: number, total: number): number {
  return Math.round((count / total) * 100);
}

function outcomeSortKey(id: string): string {
  return id === UNRESOLVED_OUTCOME_ID ? "\uffff" : id;
}

export function allocateOutcomePercents(
  counts: [string, number][],
  total: number
): Record<string, number> {
  const exact = counts.map(([id, count]) => ({
    id,
    value: total === 0 ? 0 : (count / total) * 100,
  }));
  const result = Object.fromEntries(
    exact.map(({ id, value }) => [id, Math.floor(value)])
  );
  let remainder =
    100 - Object.values(result).reduce((sum, value) => sum + value, 0);

  for (const { id } of exact
    .map((entry) => ({
      ...entry,
      fraction: entry.value - Math.floor(entry.value),
    }))
    .sort(
      (a, b) =>
        b.fraction - a.fraction ||
        outcomeSortKey(a.id).localeCompare(outcomeSortKey(b.id))
    )) {
    if (remainder <= 0) break;
    result[id]++;
    remainder--;
  }

  return result;
}

function calcConfidence(
  roundsPlayed: number,
  unresolvedProbability: number
): ForecastConfidence {
  if (roundsPlayed < 5 || unresolvedProbability >= 25) return "low";
  if (roundsPlayed < 8 || unresolvedProbability >= 10) return "medium";
  return "high";
}

function buildSeed(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>
): number {
  const seedText = players
    .map((p) => {
      const deltas = deltasByPlayer?.[p.id] ?? [];
      return `${p.id}:${p.score}:${p.roundsPlayed}:${deltas.join(",")}`;
    })
    .sort()
    .join("|");

  let seed = winThreshold >>> 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619) >>> 0;
  }
  return seed || 1;
}

/**
 * Monte Carlo race forecast.
 *
 * For each simulation we sample future round scores from a normal distribution
 * fitted to each player's current-game per-round deltas, then check who crosses
 * the win threshold first. All returned forecast facts come from the same
 * simulation pass so the percentages and round ranges stay coherent.
 *
 * When per-round deltas are available the model captures both scoring pace *and*
 * variance, which the old pace-ratio approach ignored entirely.
 *
 * Falls back to aggregate score + roundsPlayed when deltas are unavailable.
 */
export function calcRaceForecast(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>
): RaceForecast | null {
  if (players.length === 0) return null;
  const roundsPlayed = players[0].roundsPlayed;
  if (roundsPlayed < 3) return null;

  const orderedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));

  // Build per-player stats from deltas when available
  const stats: PlayerStats[] = orderedPlayers.map((p) => {
    const deltas = deltasByPlayer?.[p.id];
    if (deltas && deltas.length >= 2) {
      const m = mean(deltas);
      const s = stddev(deltas, m);
      return { id: p.id, currentScore: p.score, mean: m, std: s };
    }
    // Fallback: infer mean from aggregate, assume moderate variance
    const m = p.roundsPlayed > 0 ? p.score / p.roundsPlayed : 0;
    return { id: p.id, currentScore: p.score, mean: m, std: Math.abs(m) * 0.5 };
  });

  // If every player has non-positive mean, no one is progressing
  if (stats.every((s) => s.mean <= 0)) {
    return {
      players: Object.fromEntries(
        players.map((p) => [
          p.id,
          {
            id: p.id,
            winProbability: 0,
            nextRoundWinProbability: 0,
            winningRound: null,
          },
        ])
      ),
      gameEndRound: null,
      unresolvedProbability: 100,
      confidence: "low",
      simulationCount: SIMULATION_COUNT,
    };
  }

  const rng = makeRng(buildSeed(players, winThreshold, deltasByPlayer));

  const wins: Record<string, number> = {};
  const nextRoundWins: Record<string, number> = {};
  const winningRounds: Record<string, number[]> = {};
  for (const p of players) wins[p.id] = 0;
  for (const p of players) nextRoundWins[p.id] = 0;
  for (const p of players) winningRounds[p.id] = [];
  const gameEndRounds: number[] = [];
  let unresolvedCount = 0;

  for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
    const scores = stats.map((s) => s.currentScore);
    let winnerId: string | null = null;
    let winningRound: number | null = null;

    for (let r = 0; r < MAX_FUTURE_ROUNDS; r++) {
      for (let i = 0; i < stats.length; i++) {
        scores[i] += clampRoundScore(
          normalSample(stats[i].mean, stats[i].std, rng)
        );
      }
      // Check if any player crossed the threshold this round
      let bestScore = -Infinity;
      for (let i = 0; i < stats.length; i++) {
        if (scores[i] >= winThreshold && scores[i] > bestScore) {
          bestScore = scores[i];
          winnerId = stats[i].id;
          winningRound = roundsPlayed + r + 1;
        }
      }
      if (winnerId) break;
    }

    if (winnerId && winningRound !== null) {
      wins[winnerId]++;
      winningRounds[winnerId].push(winningRound);
      gameEndRounds.push(winningRound);
      if (winningRound === roundsPlayed + 1) {
        nextRoundWins[winnerId]++;
      }
    } else {
      unresolvedCount++;
    }
  }

  const outcomePercents = allocateOutcomePercents(
    [
      ...players.map((p) => [p.id, wins[p.id]] as [string, number]),
      [UNRESOLVED_OUTCOME_ID, unresolvedCount],
    ],
    SIMULATION_COUNT
  );
  const unresolvedProbability = outcomePercents[UNRESOLVED_OUTCOME_ID] ?? 0;
  const forecastPlayers: Record<string, PlayerForecast> = {};

  for (const p of players) {
    const winProbability = outcomePercents[p.id] ?? 0;
    forecastPlayers[p.id] = {
      id: p.id,
      winProbability,
      nextRoundWinProbability: Math.min(
        toPercent(nextRoundWins[p.id], SIMULATION_COUNT),
        winProbability
      ),
      winningRound: buildRange(winningRounds[p.id]),
    };
  }

  return {
    players: forecastPlayers,
    gameEndRound: buildRange(gameEndRounds),
    unresolvedProbability,
    confidence: calcConfidence(roundsPlayed, unresolvedProbability),
    simulationCount: SIMULATION_COUNT,
  };
}

export function calcWinProbabilities(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>
): Record<string, number> | null {
  const forecast = calcRaceForecast(players, winThreshold, deltasByPlayer);
  if (!forecast) return null;
  return Object.fromEntries(
    Object.values(forecast.players).map((player) => [
      player.id,
      player.winProbability,
    ])
  );
}

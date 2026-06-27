const SIMULATION_COUNT = 10_000;
const MAX_FUTURE_ROUNDS = 50;
const UNRESOLVED_OUTCOME_ID = "__unresolved";
const MIN_HISTORICAL_ROUNDS = 5;
const HISTORY_BLEND_ROUND_CAP = 8;
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
  historicalSampleCount: number;
}

export interface PredictionProfile {
  playerId: string;
  roundsPlayed: number;
  meanDelta: number;
  stdDelta: number;
  blitzRate: number;
  meanCardsPlayed: number;
  meanBlitzPileRemaining: number;
  recentDeltas: number[];
}

export type PredictionProfilesByPlayer = Record<string, PredictionProfile>;

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
  usesHistoricalData: boolean;
  historicalSampleCount: number;
}

interface RaceForecastOptions {
  predictionProfiles?: PredictionProfilesByPlayer;
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
  if (total <= 0) {
    return Object.fromEntries(counts.map(([id]) => [id, 0]));
  }

  const exact = counts.map(([id, count]) => ({
    id,
    value: (count / total) * 100,
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
  unresolvedProbability: number,
  minimumHistoricalDepth: number
): ForecastConfidence {
  if (roundsPlayed < 5 || unresolvedProbability >= 25) return "low";
  if (minimumHistoricalDepth >= 12 && unresolvedProbability < 10) return "high";
  if (roundsPlayed < 8 || unresolvedProbability >= 10) return "medium";
  return "high";
}

function hasUsableHistory(
  profile: PredictionProfile | undefined
): profile is PredictionProfile {
  return Boolean(profile && profile.roundsPlayed >= MIN_HISTORICAL_ROUNDS);
}

function calcCurrentWeight(
  currentRounds: number,
  historicalSampleCount: number
): number {
  if (currentRounds <= 0) return 0;
  const cappedHistoryRounds = Math.min(
    historicalSampleCount,
    HISTORY_BLEND_ROUND_CAP
  );
  const raw = currentRounds / (currentRounds + cappedHistoryRounds);
  return Math.min(0.85, Math.max(0.35, raw));
}

function blendStd(
  currentMean: number,
  currentStd: number,
  historicalMean: number,
  historicalStd: number,
  currentWeight: number
): number {
  const blendedMean =
    currentMean * currentWeight + historicalMean * (1 - currentWeight);
  const variance =
    currentWeight * (currentStd ** 2 + (currentMean - blendedMean) ** 2) +
    (1 - currentWeight) *
      (historicalStd ** 2 + (historicalMean - blendedMean) ** 2);
  return Math.sqrt(variance);
}

function buildPlayerStats(
  player: { id: string; score: number; roundsPlayed: number },
  deltas: number[] | undefined,
  profile: PredictionProfile | undefined
): PlayerStats {
  const currentDeltas = deltas ?? [];
  const currentMean =
    currentDeltas.length > 0
      ? mean(currentDeltas)
      : player.roundsPlayed > 0
        ? player.score / player.roundsPlayed
        : 0;
  const currentStd =
    currentDeltas.length >= 2
      ? stddev(currentDeltas, currentMean)
      : Math.abs(currentMean) * 0.5;

  if (hasUsableHistory(profile)) {
    const currentWeight = calcCurrentWeight(
      currentDeltas.length,
      profile.roundsPlayed
    );
    const blendedMean =
      currentMean * currentWeight + profile.meanDelta * (1 - currentWeight);
    const blendedStd = blendStd(
      currentMean,
      currentStd,
      profile.meanDelta,
      profile.stdDelta,
      currentWeight
    );

    return {
      id: player.id,
      currentScore: player.score,
      mean: blendedMean,
      std: blendedStd,
      historicalSampleCount: profile.roundsPlayed,
    };
  }

  if (currentDeltas.length >= 2) {
    return {
      id: player.id,
      currentScore: player.score,
      mean: currentMean,
      std: currentStd,
      historicalSampleCount: 0,
    };
  }

  return {
    id: player.id,
    currentScore: player.score,
    mean: currentMean,
    std: Math.abs(currentMean) * 0.5,
    historicalSampleCount: 0,
  };
}

function buildSeed(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>,
  predictionProfiles?: PredictionProfilesByPlayer
): number {
  const seedText = players
    .map((p) => {
      const deltas = deltasByPlayer?.[p.id] ?? [];
      const profile = predictionProfiles?.[p.id];
      const profileText = profile
        ? `${profile.roundsPlayed}:${profile.meanDelta.toFixed(
            3
          )}:${profile.stdDelta.toFixed(3)}:${profile.recentDeltas
            .slice(0, 10)
            .join(",")}`
        : "";
      return `${p.id}:${p.score}:${p.roundsPlayed}:${deltas.join(
        ","
      )}:${profileText}`;
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
  deltasByPlayer?: Record<string, number[]>,
  options: RaceForecastOptions = {}
): RaceForecast | null {
  if (players.length === 0) return null;
  const roundsPlayed = players[0].roundsPlayed;
  const hasHistoricalEvidence = players.some((p) =>
    hasUsableHistory(options.predictionProfiles?.[p.id])
  );
  if (roundsPlayed < 3 && !hasHistoricalEvidence) return null;

  const orderedPlayers = [...players].sort((a, b) => a.id.localeCompare(b.id));

  const stats: PlayerStats[] = orderedPlayers.map((p) =>
    buildPlayerStats(p, deltasByPlayer?.[p.id], options.predictionProfiles?.[p.id])
  );
  const historicalSampleCount = stats.reduce(
    (sum, stat) => sum + stat.historicalSampleCount,
    0
  );
  const usesHistoricalData = historicalSampleCount > 0;
  const historicalDepths = stats
    .map((stat) => stat.historicalSampleCount)
    .filter((count) => count > 0);
  const minimumHistoricalDepth =
    historicalDepths.length === stats.length ? Math.min(...historicalDepths) : 0;

  const rng = makeRng(
    buildSeed(players, winThreshold, deltasByPlayer, options.predictionProfiles)
  );

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
    let winnerIndexes: number[] = [];
    let winningRound: number | null = null;

    for (let r = 0; r < MAX_FUTURE_ROUNDS; r++) {
      for (let i = 0; i < stats.length; i++) {
        scores[i] += clampRoundScore(
          normalSample(stats[i].mean, stats[i].std, rng)
        );
      }
      // Check if any player crossed the threshold this round
      let bestScore = -Infinity;
      const crossingIndexes: number[] = [];
      for (let i = 0; i < stats.length; i++) {
        if (scores[i] < winThreshold) continue;
        if (scores[i] > bestScore) {
          bestScore = scores[i];
          crossingIndexes.length = 0;
          crossingIndexes.push(i);
        } else if (scores[i] === bestScore) {
          crossingIndexes.push(i);
        }
      }
      if (crossingIndexes.length > 0) {
        winnerIndexes = crossingIndexes;
        winningRound = roundsPlayed + r + 1;
        break;
      }
    }

    if (winnerIndexes.length > 0 && winningRound !== null) {
      const splitWeight = 1 / winnerIndexes.length;

      for (const winnerIndex of winnerIndexes) {
        const winnerId = stats[winnerIndex].id;
        wins[winnerId] += splitWeight;
        winningRounds[winnerId].push(winningRound);
        if (winningRound === roundsPlayed + 1) {
          nextRoundWins[winnerId] += splitWeight;
        }
      }

      gameEndRounds.push(winningRound);
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
    confidence: calcConfidence(
      roundsPlayed,
      unresolvedProbability,
      minimumHistoricalDepth
    ),
    simulationCount: SIMULATION_COUNT,
    usesHistoricalData,
    historicalSampleCount,
  };
}

export function calcWinProbabilities(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>,
  options: RaceForecastOptions = {}
): Record<string, number> | null {
  const forecast = calcRaceForecast(
    players,
    winThreshold,
    deltasByPlayer,
    options
  );
  if (!forecast) return null;
  return Object.fromEntries(
    Object.values(forecast.players).map((player) => [
      player.id,
      player.winProbability,
    ])
  );
}

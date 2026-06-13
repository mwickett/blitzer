export function calcProjectedFinishRound(
  currentScore: number,
  roundsPlayed: number,
  winThreshold: number
): number {
  if (currentScore >= winThreshold) return roundsPlayed;
  const pace = roundsPlayed > 0 ? currentScore / roundsPlayed : 0;
  if (pace <= 0) return Infinity;
  return Math.ceil(winThreshold / pace);
}

const SIMULATION_COUNT = 10_000;
const MAX_FUTURE_ROUNDS = 50;

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

/**
 * Monte Carlo win-probability estimation.
 *
 * For each simulation we sample future round scores from a normal distribution
 * fitted to each player's historical per-round deltas, then check who crosses
 * the win threshold first. The fraction of simulations won gives the probability.
 *
 * When per-round deltas are available the model captures both scoring pace *and*
 * variance, which the old pace-ratio approach ignored entirely.
 *
 * Falls back to the simpler pace-ratio heuristic when deltas are unavailable
 * (e.g. when only aggregate score + roundsPlayed are known).
 */
export function calcWinProbabilities(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number,
  deltasByPlayer?: Record<string, number[]>
): Record<string, number> | null {
  if (players.length === 0) return null;
  if (players[0].roundsPlayed < 3) return null;

  // Build per-player stats from deltas when available
  const stats: PlayerStats[] = players.map((p) => {
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
    return Object.fromEntries(players.map((p) => [p.id, 0]));
  }

  // Deterministic seed from current game state
  const seed =
    players.reduce((h, p) => h * 31 + Math.round(p.score * 100), 7) >>> 0;
  const rng = makeRng(seed);

  const wins: Record<string, number> = {};
  for (const p of players) wins[p.id] = 0;

  for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
    const scores = stats.map((s) => s.currentScore);
    let winnerId: string | null = null;

    for (let r = 0; r < MAX_FUTURE_ROUNDS; r++) {
      for (let i = 0; i < stats.length; i++) {
        scores[i] += normalSample(stats[i].mean, stats[i].std, rng);
      }
      // Check if any player crossed the threshold this round
      let bestScore = -Infinity;
      for (let i = 0; i < stats.length; i++) {
        if (scores[i] >= winThreshold && scores[i] > bestScore) {
          bestScore = scores[i];
          winnerId = stats[i].id;
        }
      }
      if (winnerId) break;
    }

    if (winnerId) wins[winnerId]++;
  }

  // Convert counts to integer percentages
  const result: Record<string, number> = {};
  for (const p of players) {
    result[p.id] = Math.round((wins[p.id] / SIMULATION_COUNT) * 100);
  }

  // Fix rounding to sum to exactly 100
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum !== 100 && sum > 0) {
    const maxId = Object.entries(result).reduce((a, b) =>
      b[1] > a[1] ? b : a
    )[0];
    result[maxId] += 100 - sum;
  }

  return result;
}

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

export function calcWinProbabilities(
  players: { id: string; score: number; roundsPlayed: number }[],
  winThreshold: number
): Record<string, number> | null {
  if (players.length === 0) return null;
  if (players[0].roundsPlayed < 3) return null;

  const paces = players.map((p) => ({
    id: p.id,
    pace: p.roundsPlayed > 0 ? p.score / p.roundsPlayed : 0,
  }));

  // Only players with positive pace can win
  const positivePaces = paces.filter((p) => p.pace > 0);
  const totalPace = positivePaces.reduce((sum, p) => sum + p.pace, 0);

  if (totalPace === 0) {
    return Object.fromEntries(players.map((p) => [p.id, 0]));
  }

  const result: Record<string, number> = {};
  for (const p of paces) {
    result[p.id] = p.pace > 0 ? Math.round((p.pace / totalPace) * 100) : 0;
  }

  // Adjust rounding to sum to exactly 100
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum !== 100 && positivePaces.length > 0) {
    result[positivePaces[0].id] += 100 - sum;
  }

  return result;
}

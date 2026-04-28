interface TieBreakCandidate {
  playerId: string;
  blitzPileRemaining: number;
}

/**
 * Break a tie among players with equal scores.
 * The player with the fewest blitz cards remaining wins.
 * If still tied, first in the array wins (stable).
 */
export function breakTie(candidates: TieBreakCandidate[]): string {
  if (candidates.length === 0) {
    throw new Error("breakTie requires at least one candidate");
  }
  let bestId = candidates[0].playerId;
  let bestRemaining = candidates[0].blitzPileRemaining ?? 10;

  for (let i = 1; i < candidates.length; i++) {
    const remaining = candidates[i].blitzPileRemaining ?? 10;
    if (remaining < bestRemaining) {
      bestRemaining = remaining;
      bestId = candidates[i].playerId;
    }
  }

  return bestId;
}

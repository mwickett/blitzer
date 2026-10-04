export interface RoundResult {
  deltas: Record<string, number>;
  blitzCounts: Record<string, number>;
}

export interface GameStats {
  roundsPlayed: number;
  biggestRound: { delta: number; playerName: string; roundNumber: number };
  worstRound: { delta: number; playerName: string; roundNumber: number };
  blitzCounts: Record<string, number>;
  totalBlitzes: number;
  roundWins: Record<string, number>;
  /**
   * The round with the biggest gap between its top score and the average of
   * everyone else's score that round; null with fewer than two players.
   */
  widestRound: {
    range: number;
    playerName: string;
    roundNumber: number;
  } | null;
  /** The same gap on final totals: the leader against the field's average. */
  finalSpread: number | null;
}

/** Top value minus the mean of the rest; null without at least two values. */
export function spread(values: number[]): number | null {
  if (values.length < 2) return null;
  const top = Math.max(...values);
  const rest = [...values];
  rest.splice(rest.indexOf(top), 1);
  const restMean = rest.reduce((sum, value) => sum + value, 0) / rest.length;
  return Math.round((top - restMean) * 10) / 10;
}

export function calcGameStats(
  rounds: RoundResult[],
  playerNames: Record<string, string>,
): GameStats {
  let biggestRound = { delta: -Infinity, playerName: "", roundNumber: 0 };
  let worstRound = { delta: Infinity, playerName: "", roundNumber: 0 };
  const blitzCounts: Record<string, number> = {};
  const roundWins: Record<string, number> = {};
  const totals: Record<string, number> = {};
  let widestRound: GameStats["widestRound"] = null;

  for (const pid of Object.keys(playerNames)) {
    blitzCounts[pid] = 0;
    roundWins[pid] = 0;
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    let bestDelta = -Infinity;
    let bestPlayers: string[] = [];

    for (const [pid, delta] of Object.entries(round.deltas)) {
      totals[pid] = (totals[pid] ?? 0) + delta;
      if (delta > biggestRound.delta) {
        biggestRound = {
          delta,
          playerName: playerNames[pid] ?? pid,
          roundNumber: ri + 1,
        };
      }
      if (delta < worstRound.delta) {
        worstRound = {
          delta,
          playerName: playerNames[pid] ?? pid,
          roundNumber: ri + 1,
        };
      }
      if (delta > bestDelta) {
        bestDelta = delta;
        bestPlayers = [pid];
      } else if (delta === bestDelta) {
        bestPlayers.push(pid);
      }
    }

    // Tied top scores share the round win.
    for (const pid of bestPlayers) roundWins[pid]++;

    const range = spread(Object.values(round.deltas));
    if (range !== null && range > (widestRound?.range ?? -Infinity)) {
      widestRound = {
        range,
        // A shared top score names the first of the tied players.
        playerName: playerNames[bestPlayers[0]] ?? bestPlayers[0],
        roundNumber: ri + 1,
      };
    }

    for (const [pid, count] of Object.entries(round.blitzCounts)) {
      blitzCounts[pid] += count;
    }
  }

  return {
    roundsPlayed: rounds.length,
    biggestRound,
    worstRound,
    blitzCounts,
    totalBlitzes: Object.values(blitzCounts).reduce((a, b) => a + b, 0),
    roundWins,
    widestRound,
    finalSpread: spread(Object.values(totals)),
  };
}

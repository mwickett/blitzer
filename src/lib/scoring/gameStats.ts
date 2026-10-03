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
}

export function calcGameStats(
  rounds: RoundResult[],
  playerNames: Record<string, string>
): GameStats {
  let biggestRound = { delta: -Infinity, playerName: "", roundNumber: 0 };
  let worstRound = { delta: Infinity, playerName: "", roundNumber: 0 };
  const blitzCounts: Record<string, number> = {};
  const roundWins: Record<string, number> = {};

  for (const pid of Object.keys(playerNames)) {
    blitzCounts[pid] = 0;
    roundWins[pid] = 0;
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const round = rounds[ri];
    let bestDelta = -Infinity;
    let bestPlayers: string[] = [];

    for (const [pid, delta] of Object.entries(round.deltas)) {
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
  };
}

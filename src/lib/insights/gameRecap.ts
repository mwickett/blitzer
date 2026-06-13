import transformGameData, { type GameWithPlayersAndScores } from "@/lib/gameLogic";
import { calcGameStats, type RoundResult } from "@/lib/scoring/gameStats";
import { calculateRoundScore } from "@/lib/validation/gameRules";

export const MIN_ROUNDS_FOR_SUMMARY = 2;
export const MIN_PLAYERS_FOR_SUMMARY = 2;

// A playerKey is a registered user's id OR a guest's id — never a display name,
// so two guests sharing a name stay distinct.
export interface RecapStanding {
  playerKey: string;
  total: number;
  isWinner: boolean;
  rank: number;
}

// Facts are built entirely in playerKey space with no real names and no raw
// score rows, so the hash is order-stable and no display names reach the LLM.
export interface GameRecapFacts {
  gameId: string;
  organizationId: string | null;
  winThreshold: number;
  roundsPlayed: number;
  playerCount: number;
  standings: RecapStanding[];
  winnerKey: string | null;
  tiebreakUsed: boolean;
  biggestRound: { delta: number; playerKey: string; roundNumber: number };
  worstRound: { delta: number; playerKey: string; roundNumber: number };
  blitzLeader: { playerKey: string; blitzes: number } | null;
  totalBlitzes: number;
  leadChanges: number;
}

export interface BuiltRecap {
  facts: GameRecapFacts;
  /** playerKey -> real display name. Used only server-side for rehydration. */
  playerNames: Record<string, string>;
}

export function buildGameRecap(game: GameWithPlayersAndScores): BuiltRecap {
  const display = transformGameData(game);

  const playerNames: Record<string, string> = {};
  const identityNames: Record<string, string> = {};
  for (const d of display) {
    playerNames[d.id] = d.username;
    identityNames[d.id] = d.id; // feed playerKeys as "names" so stats are keyed
  }

  // Per-round deltas + blitz counts, keyed by playerKey.
  const rounds: RoundResult[] = game.rounds.map((round) => {
    const deltas: Record<string, number> = {};
    const blitzCounts: Record<string, number> = {};
    for (const id of Object.keys(identityNames)) {
      deltas[id] = 0;
      blitzCounts[id] = 0;
    }
    for (const s of round.scores) {
      const key = s.userId || s.guestId;
      if (!key || !(key in identityNames)) continue;
      deltas[key] = calculateRoundScore({
        blitzPileRemaining: s.blitzPileRemaining,
        totalCardsPlayed: s.totalCardsPlayed,
      });
      if (s.blitzPileRemaining === 0) blitzCounts[key] += 1;
    }
    return { deltas, blitzCounts };
  });

  // biggestRound/worstRound.playerName is now a playerKey (identity map).
  const stats = calcGameStats(rounds, identityNames);

  // Winner first, then total desc, then playerKey asc — so standings[0] is the
  // real winner even when totals tie and the blitz-pile tiebreak decided it.
  const sorted = [...display].sort(
    (a, b) =>
      (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0) ||
      b.total - a.total ||
      a.id.localeCompare(b.id)
  );
  const standings: RecapStanding[] = sorted.map((d, i) => ({
    playerKey: d.id,
    total: d.total,
    isWinner: !!d.isWinner,
    rank: i + 1,
  }));

  const winner = display.find((d) => d.isWinner) ?? null;

  const topTotal = standings.length
    ? Math.max(...standings.map((s) => s.total))
    : 0;
  const reachedTop = standings.filter(
    (s) => s.total >= game.winThreshold && s.total === topTotal
  );
  const tiebreakUsed = reachedTop.length > 1;

  // Blitz leader: most blitzes, ties broken by lowest playerKey (deterministic).
  let blitzLeader: { playerKey: string; blitzes: number } | null = null;
  for (const key of Object.keys(stats.blitzCounts).sort()) {
    const n = stats.blitzCounts[key];
    if (n > 0 && (!blitzLeader || n > blitzLeader.blitzes)) {
      blitzLeader = { playerKey: key, blitzes: n };
    }
  }

  // Lead changes: cumulative leader transitions, leader ties broken by lowest key.
  const cumulative: Record<string, number> = {};
  for (const id of Object.keys(identityNames)) cumulative[id] = 0;
  let prevLeader: string | null = null;
  let leadChanges = 0;
  for (const r of rounds) {
    for (const [id, delta] of Object.entries(r.deltas)) cumulative[id] += delta;
    let leader: string | null = null;
    let best = -Infinity;
    for (const id of Object.keys(cumulative).sort()) {
      if (cumulative[id] > best) {
        best = cumulative[id];
        leader = id;
      }
    }
    if (leader && prevLeader && leader !== prevLeader) leadChanges++;
    prevLeader = leader;
  }

  const facts: GameRecapFacts = {
    gameId: game.id,
    organizationId: game.organizationId ?? null,
    winThreshold: game.winThreshold,
    roundsPlayed: stats.roundsPlayed,
    playerCount: display.length,
    standings,
    winnerKey: winner?.id ?? null,
    tiebreakUsed,
    biggestRound: {
      delta: stats.biggestRound.delta,
      playerKey: stats.biggestRound.playerName,
      roundNumber: stats.biggestRound.roundNumber,
    },
    worstRound: {
      delta: stats.worstRound.delta,
      playerKey: stats.worstRound.playerName,
      roundNumber: stats.worstRound.roundNumber,
    },
    blitzLeader,
    totalBlitzes: stats.totalBlitzes,
    leadChanges,
  };

  return { facts, playerNames };
}

// Source timestamp for stale-summary detection: the newest score edit, falling
// back to game end. Not part of the hashed facts.
export function latestSourceUpdatedAt(game: GameWithPlayersAndScores): Date {
  let latest: Date | null = null;
  for (const r of game.rounds) {
    for (const s of r.scores) {
      if (s.updatedAt && (!latest || s.updatedAt > latest)) latest = s.updatedAt;
    }
  }
  return latest ?? game.endedAt ?? new Date();
}

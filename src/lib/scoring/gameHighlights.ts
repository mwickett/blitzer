import { getGameCompletion, type ScoredGame } from "@/lib/gameLogic";
import { calculateRoundScore } from "@/lib/validation/gameRules";

/**
 * Deterministic "moments" from a finished game's round-by-round series.
 * The scoring UI passes per-player arrays from buildRoundGraphSeries; other
 * callers (for example post-game stories) use findScoredGameHighlights.
 */
export interface HighlightPlayer {
  id: string;
  name: string;
}

export type GameHighlight =
  | { kind: "wire_to_wire"; playerId: string }
  | { kind: "comeback"; playerId: string; deficit: number; roundNumber: number }
  | { kind: "lead_changes"; count: number }
  | { kind: "photo_finish"; playerId: string; margin: number }
  | { kind: "lone_survivor"; playerId: string; roundNumber: number }
  | { kind: "blitz_streak"; playerId: string; length: number };

export const COMEBACK_MIN_DEFICIT = 15;
export const PHOTO_FINISH_MAX_MARGIN = 5;
export const MIN_LEAD_CHANGES = 2;
export const MIN_BLITZ_STREAK = 3;
/** Leading after one or two rounds is routine, so wire-to-wire needs three. */
export const WIRE_TO_WIRE_MIN_ROUNDS = 3;

/** Sole leader after a round, or null when the lead is shared. */
export function soleLeader(
  players: HighlightPlayer[],
  scoresByRound: Record<string, number[]>,
  round: number,
): string | null {
  let best = -Infinity;
  let leader: string | null = null;
  for (const p of players) {
    const score = scoresByRound[p.id]?.[round] ?? 0;
    if (score > best) {
      best = score;
      leader = p.id;
    } else if (score === best) {
      leader = null;
    }
  }
  return leader;
}

export interface LeadChange {
  /** 1-based round after which the new leader went ahead. */
  roundNumber: number;
  playerId: string;
  previousLeaderId: string;
}

/**
 * Every time the sole lead passed to a different player. A tied round keeps
 * the previous leader, so passing through a tie back to them is no change.
 */
export function findLeadChanges(
  players: HighlightPlayer[],
  scoresByRound: Record<string, number[]>,
): LeadChange[] {
  const roundCount = Math.max(0, ...players.map((p) => scoresByRound[p.id]?.length ?? 0));
  const changes: LeadChange[] = [];
  let previous: string | null = null;
  for (let r = 0; r < roundCount; r++) {
    const leader = soleLeader(players, scoresByRound, r);
    if (leader === null) continue;
    if (previous !== null && leader !== previous) {
      changes.push({ roundNumber: r + 1, playerId: leader, previousLeaderId: previous });
    }
    previous = leader;
  }
  return changes;
}

export function findGameHighlights({
  players,
  winnerId,
  scoresByRound,
  deltasByRound,
  blitzByRound,
}: {
  players: HighlightPlayer[];
  winnerId: string;
  scoresByRound: Record<string, number[]>;
  deltasByRound: Record<string, number[]>;
  blitzByRound: Record<string, (number | null)[]>;
}): GameHighlight[] {
  const roundCount = scoresByRound[winnerId]?.length ?? 0;
  if (roundCount === 0 || players.length < 2) return [];
  const highlights: GameHighlight[] = [];

  // Leadership across rounds (ties break no streak and change no lead).
  const leaders = Array.from({ length: roundCount }, (_, r) =>
    soleLeader(players, scoresByRound, r),
  );
  const leadChanges = findLeadChanges(players, scoresByRound).length;

  if (
    roundCount >= WIRE_TO_WIRE_MIN_ROUNDS &&
    leaders.every((leader) => leader === winnerId)
  ) {
    highlights.push({ kind: "wire_to_wire", playerId: winnerId });
  }

  let deficit = 0;
  let deficitRound = 0;
  for (let r = 0; r < roundCount; r++) {
    const winnerScore = scoresByRound[winnerId][r];
    const top = Math.max(...players.map((p) => scoresByRound[p.id]?.[r] ?? 0));
    if (top - winnerScore > deficit) {
      deficit = top - winnerScore;
      deficitRound = r + 1;
    }
  }
  if (deficit >= COMEBACK_MIN_DEFICIT) {
    highlights.push({
      kind: "comeback",
      playerId: winnerId,
      deficit,
      roundNumber: deficitRound,
    });
  }

  if (leadChanges >= MIN_LEAD_CHANGES) {
    highlights.push({ kind: "lead_changes", count: leadChanges });
  }

  const finals = players
    .map((p) => scoresByRound[p.id]?.[roundCount - 1] ?? 0)
    .sort((a, b) => b - a);
  const margin = finals[0] - finals[1];
  if (margin <= PHOTO_FINISH_MAX_MARGIN) {
    highlights.push({ kind: "photo_finish", playerId: winnerId, margin });
  }

  // A round where one player scored and everyone else went negative.
  if (players.length >= 3) {
    for (let r = 0; r < roundCount; r++) {
      const positive = players.filter(
        (p) => (deltasByRound[p.id]?.[r] ?? 0) > 0,
      );
      const negative = players.filter(
        (p) => (deltasByRound[p.id]?.[r] ?? 0) < 0,
      );
      if (positive.length === 1 && negative.length === players.length - 1) {
        highlights.push({
          kind: "lone_survivor",
          playerId: positive[0].id,
          roundNumber: r + 1,
        });
        break;
      }
    }
  }

  let bestStreak: { playerId: string; length: number } | null = null;
  for (const p of players) {
    let run = 0;
    for (const left of blitzByRound[p.id] ?? []) {
      run = left === 0 ? run + 1 : 0;
      if (run >= MIN_BLITZ_STREAK && run > (bestStreak?.length ?? 0)) {
        bestStreak = { playerId: p.id, length: run };
      }
    }
  }
  if (bestStreak) highlights.push({ kind: "blitz_streak", ...bestStreak });

  return highlights;
}

export interface ScoredGameSeries {
  players: HighlightPlayer[];
  winnerId: string | null;
  scoresByRound: Record<string, number[]>;
  deltasByRound: Record<string, number[]>;
  blitzByRound: Record<string, (number | null)[]>;
}

/**
 * Per-player round series for a stored game (ScoredGame or GameDetail), in
 * round order. Player ids are the userId or guestId, matching scoring and
 * gameLogic.
 */
export function buildScoredGameSeries(game: ScoredGame): ScoredGameSeries {
  const players = game.players.map((p) => ({
    id: p.userId ?? p.guestId ?? p.id,
    name: p.user?.username ?? p.guestUser?.name ?? "Unknown Player",
  }));
  const { winnerId } = getGameCompletion(game);

  const rounds = [...game.rounds].sort((a, b) => a.round - b.round);
  const scoresByRound: Record<string, number[]> = {};
  const deltasByRound: Record<string, number[]> = {};
  const blitzByRound: Record<string, (number | null)[]> = {};
  for (const player of players) {
    let total = 0;
    scoresByRound[player.id] = [];
    deltasByRound[player.id] = [];
    blitzByRound[player.id] = [];
    for (const round of rounds) {
      const score = round.scores.find(
        (s) => (s.userId ?? s.guestId) === player.id,
      );
      const delta = score ? calculateRoundScore(score) : 0;
      total += delta;
      scoresByRound[player.id].push(total);
      deltasByRound[player.id].push(delta);
      blitzByRound[player.id].push(score ? score.blitzPileRemaining : null);
    }
  }
  return { players, winnerId, scoresByRound, deltasByRound, blitzByRound };
}

/**
 * Highlights for a finished game loaded as a ScoredGame (or GameDetail).
 * Returns no highlights until the game has a winner.
 */
export function findScoredGameHighlights(game: ScoredGame): {
  players: HighlightPlayer[];
  winnerId: string | null;
  highlights: GameHighlight[];
} {
  const { players, winnerId, ...series } = buildScoredGameSeries(game);
  if (!winnerId) return { players, winnerId, highlights: [] };
  return {
    players,
    winnerId,
    highlights: findGameHighlights({ players, winnerId, ...series }),
  };
}

/** Display copy shared by the finished screen and any text summaries. */
export function describeHighlight(
  highlight: GameHighlight,
  name: (playerId: string) => string,
): { icon: string; title: string; detail: string } {
  switch (highlight.kind) {
    case "wire_to_wire":
      return {
        icon: "🚂",
        title: "Wire to wire",
        detail: `${name(highlight.playerId)} led after every round.`,
      };
    case "comeback":
      return {
        icon: "🔄",
        title: "Comeback",
        detail: `${name(highlight.playerId)} was ${highlight.deficit} points back after round ${highlight.roundNumber} and still won.`,
      };
    case "lead_changes":
      return {
        icon: "🔀",
        title: "Seesaw",
        detail: `The lead changed hands ${highlight.count} times.`,
      };
    case "photo_finish":
      return {
        icon: "📸",
        title: "Photo finish",
        detail:
          highlight.margin === 0
            ? "Level on points; decided on the tiebreak."
            : `Won by just ${highlight.margin} ${highlight.margin === 1 ? "point" : "points"}.`,
      };
    case "lone_survivor":
      return {
        icon: "🎯",
        title: "Snipe",
        detail: `In round ${highlight.roundNumber}, ${name(highlight.playerId)} was the only one to score. Everyone else went negative.`,
      };
    case "blitz_streak":
      return {
        icon: "⚡",
        title: highlight.length === 3 ? "Triple blitz" : "On fire",
        detail: `${name(highlight.playerId)} blitzed ${highlight.length} rounds in a row.`,
      };
  }
}

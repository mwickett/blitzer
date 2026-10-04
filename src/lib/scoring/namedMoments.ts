import { GAME_RULES } from "@/lib/validation/gameRules";
import {
  buildScoredGameSeries,
  findLeadChanges,
  soleLeader,
  type HighlightPlayer,
} from "@/lib/scoring/gameHighlights";
import type { ScoredGame } from "@/lib/gameLogic";

/**
 * Named moments (#95): the game's turning points the table gives a name to.
 * They sit beside the highlights in gameHighlights.ts, which already cover
 * "Snipe" (lone_survivor) and "Triple blitz" (blitz_streak). Bounce backs
 * span two games, so they are counted in summarizeMomentHistory.
 *
 * Entry points: findNamedMoments for round series the UI already has,
 * findScoredGameNamedMoments for a stored game, and summarizeMomentHistory
 * for cross-game tallies and the dashboard feed.
 */
export type NamedMoment =
  /** The winner was alone in last while the then-leader finished alone in last. */
  | { kind: "tornado"; playerId: string; victimId: string; roundNumber: number }
  /** Alone in last before a round and alone in first after it. */
  | { kind: "u_turn"; playerId: string; roundNumber: number }
  /** A full-length game won in very few rounds. */
  | { kind: "short_fuse"; playerId: string; roundCount: number }
  /** A player finished the game below zero. */
  | { kind: "shortcoming"; playerId: string; score: number };

export type NamedMomentKind = NamedMoment["kind"];

/**
 * A game to the standard 75 points normally takes six or more rounds, so
 * reaching it in four is fast. Games with a lower target never qualify.
 */
export const SHORT_FUSE_MAX_ROUNDS = 4;

/** The sole last-placed player after a round, or null when it is shared. */
function soleLast(
  players: HighlightPlayer[],
  scoresByRound: Record<string, number[]>,
  round: number,
): string | null {
  let worst = Infinity;
  let last: string | null = null;
  for (const p of players) {
    const score = scoresByRound[p.id]?.[round] ?? 0;
    if (score < worst) {
      worst = score;
      last = p.id;
    } else if (score === worst) {
      last = null;
    }
  }
  return last;
}

export function findNamedMoments({
  players,
  winnerId,
  scoresByRound,
  winThreshold = GAME_RULES.POINTS_TO_WIN,
}: {
  players: HighlightPlayer[];
  winnerId: string;
  /** Cumulative totals per player after each round. */
  scoresByRound: Record<string, number[]>;
  winThreshold?: number;
}): NamedMoment[] {
  const roundCount = scoresByRound[winnerId]?.length ?? 0;
  if (roundCount === 0 || players.length < 2) return [];
  const moments: NamedMoment[] = [];
  const finalRound = roundCount - 1;

  // Tornado and U-turn need someone in the middle: with two players they are
  // just a lead change.
  if (players.length >= 3) {
    const finalLast = soleLast(players, scoresByRound, finalRound);
    // The latest round where the table stood upside down.
    for (let r = finalRound - 1; r >= 0; r--) {
      const leader = soleLeader(players, scoresByRound, r);
      if (
        leader !== null &&
        leader !== winnerId &&
        leader === finalLast &&
        soleLast(players, scoresByRound, r) === winnerId
      ) {
        moments.push({ kind: "tornado", playerId: winnerId, victimId: leader, roundNumber: r + 1 });
        break;
      }
    }

    // The first single-round jump from last to first.
    for (let r = 1; r < roundCount; r++) {
      const before = soleLast(players, scoresByRound, r - 1);
      if (before !== null && soleLeader(players, scoresByRound, r) === before) {
        moments.push({ kind: "u_turn", playerId: before, roundNumber: r + 1 });
        break;
      }
    }
  }

  if (roundCount <= SHORT_FUSE_MAX_ROUNDS && winThreshold >= GAME_RULES.POINTS_TO_WIN) {
    moments.push({ kind: "short_fuse", playerId: winnerId, roundCount });
  }

  // The lowest finish below zero (the first listed player on a tie).
  let lowest: { playerId: string; score: number } | null = null;
  for (const p of players) {
    const score = scoresByRound[p.id]?.[finalRound] ?? 0;
    if (score < 0 && score < (lowest?.score ?? 0)) lowest = { playerId: p.id, score };
  }
  if (lowest) moments.push({ kind: "shortcoming", ...lowest });

  return moments;
}

/** Named moments for a stored game; none until it has a winner. */
export function findScoredGameNamedMoments(game: ScoredGame): {
  players: HighlightPlayer[];
  winnerId: string | null;
  moments: NamedMoment[];
} {
  const { players, winnerId, scoresByRound } = buildScoredGameSeries(game);
  if (!winnerId) return { players, winnerId, moments: [] };
  return {
    players,
    winnerId,
    moments: findNamedMoments({ players, winnerId, scoresByRound, winThreshold: game.winThreshold }),
  };
}

// The dashboard names the viewer "You", which reads oddly mid-sentence.
const midSentence = (name: string) => (name === "You" ? "you" : name);

/** Display copy shared by the finished screen and the dashboard feed. */
export function describeNamedMoment(
  moment: NamedMoment,
  name: (playerId: string) => string,
): { icon: string; title: string; detail: string } {
  switch (moment.kind) {
    case "tornado":
      return {
        icon: "🌪️",
        title: "Tornado",
        detail: `${name(moment.playerId)} climbed from dead last after round ${moment.roundNumber} to the win, while ${midSentence(name(moment.victimId))}, leading then, finished last.`,
      };
    case "u_turn":
      return {
        icon: "↩️",
        title: "U-turn",
        detail: `${name(moment.playerId)} went from last to first in round ${moment.roundNumber}.`,
      };
    case "short_fuse":
      return {
        icon: "🧨",
        title: "Short fuse",
        detail: `${name(moment.playerId)} won in just ${moment.roundCount} ${moment.roundCount === 1 ? "round" : "rounds"}.`,
      };
    case "shortcoming":
      return {
        icon: "🕳️",
        title: "Shortcoming",
        detail: `${name(moment.playerId)} finished on ${moment.score} points.`,
      };
  }
}

/** One finished game's round series, as the history query loads it. */
export interface MomentHistoryGame {
  gameId: string;
  /** ISO timestamp. */
  finishedAt: string;
  winnerId: string | null;
  winThreshold: number;
  players: HighlightPlayer[];
  scoresByRound: Record<string, number[]>;
}

export interface MomentFeedItem {
  key: string;
  gameId: string;
  finishedAt: string;
  icon: string;
  title: string;
  detail: string;
  /** Whether the viewer is the moment's main player. */
  starring: boolean;
}

export interface LeadChangeSummary {
  gamesAnalyzed: number;
  gamesWithLeadChanges: number;
  totalLeadChanges: number;
  /** Lead changes that put the viewer in front. */
  leadsTaken: number;
  /** Lead changes that took the lead from the viewer. */
  leadsLost: number;
  /** Games the viewer won after trailing at some point. */
  winsFromBehind: number;
  mostLeadChanges: { gameId: string; finishedAt: string; count: number } | null;
}

export interface MomentHistory {
  leadChanges: LeadChangeSummary;
  /** Moments the viewer starred in, by kind, plus bounce backs. */
  mine: Record<NamedMomentKind | "bounce_back", number>;
  /** Tornadoes where the viewer was the leader who fell to last. */
  tornadoesSuffered: number;
  /** Newest first. */
  feed: MomentFeedItem[];
}

export const MOMENT_FEED_LIMIT = 5;

/**
 * Cross-game tallies for one viewer over their finished games (#54, #95).
 * Games without a recorded winner still count toward lead changes.
 */
export function summarizeMomentHistory(
  games: MomentHistoryGame[],
  viewerId: string,
  feedLimit = MOMENT_FEED_LIMIT,
): MomentHistory {
  const ordered = [...games].sort(
    (a, b) => b.finishedAt.localeCompare(a.finishedAt) || b.gameId.localeCompare(a.gameId),
  );
  const leadChanges: LeadChangeSummary = {
    gamesAnalyzed: 0,
    gamesWithLeadChanges: 0,
    totalLeadChanges: 0,
    leadsTaken: 0,
    leadsLost: 0,
    winsFromBehind: 0,
    mostLeadChanges: null,
  };
  const mine: MomentHistory["mine"] = {
    tornado: 0,
    u_turn: 0,
    short_fuse: 0,
    shortcoming: 0,
    bounce_back: 0,
  };
  let tornadoesSuffered = 0;
  const feed: MomentFeedItem[] = [];

  for (const game of ordered) {
    const roundCount = Math.max(0, ...game.players.map((p) => game.scoresByRound[p.id]?.length ?? 0));
    if (roundCount === 0 || game.players.length < 2) continue;
    leadChanges.gamesAnalyzed++;
    const changes = findLeadChanges(game.players, game.scoresByRound);
    if (changes.length) leadChanges.gamesWithLeadChanges++;
    leadChanges.totalLeadChanges += changes.length;
    leadChanges.leadsTaken += changes.filter((c) => c.playerId === viewerId).length;
    leadChanges.leadsLost += changes.filter((c) => c.previousLeaderId === viewerId).length;
    if (changes.length > (leadChanges.mostLeadChanges?.count ?? 0)) {
      leadChanges.mostLeadChanges = { gameId: game.gameId, finishedAt: game.finishedAt, count: changes.length };
    }

    if (!game.winnerId) continue;
    if (
      game.winnerId === viewerId &&
      Array.from({ length: roundCount }).some((_, r) =>
        game.players.some(
          (p) => (game.scoresByRound[p.id]?.[r] ?? 0) > (game.scoresByRound[viewerId]?.[r] ?? 0),
        ),
      )
    ) {
      leadChanges.winsFromBehind++;
    }

    const names = new Map(game.players.map((p) => [p.id, p.id === viewerId ? "You" : p.name]));
    const name = (id: string) => names.get(id) ?? "Someone";
    for (const moment of findNamedMoments({
      players: game.players,
      winnerId: game.winnerId,
      scoresByRound: game.scoresByRound,
      winThreshold: game.winThreshold,
    })) {
      const starring = moment.playerId === viewerId;
      if (starring) mine[moment.kind]++;
      if (moment.kind === "tornado" && moment.victimId === viewerId) tornadoesSuffered++;
      if (feed.length < feedLimit) {
        feed.push({
          key: `${game.gameId}:${moment.kind}`,
          gameId: game.gameId,
          finishedAt: game.finishedAt,
          starring,
          ...describeNamedMoment(moment, name),
        });
      }
    }
  }

  // Bounce back: a loss followed by a win in the viewer's next decided game.
  const decided = ordered.filter((game) => game.winnerId).reverse();
  for (let i = 1; i < decided.length; i++) {
    if (decided[i - 1].winnerId !== viewerId && decided[i].winnerId === viewerId) {
      mine.bounce_back++;
    }
  }

  return { leadChanges, mine, tornadoesSuffered, feed };
}

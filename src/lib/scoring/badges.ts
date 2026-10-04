import {
  findGameHighlights,
  MIN_BLITZ_STREAK,
  PHOTO_FINISH_MAX_MARGIN,
  soleLeader,
  type HighlightPlayer,
} from "@/lib/scoring/gameHighlights";
import { findNamedMoments } from "@/lib/scoring/namedMoments";

/**
 * Badges a player collects across their finished games. Moment badges come
 * from the same detectors as the game page (named moments and highlights);
 * milestones count games, wins and blitzes. Nothing is stored: badges are
 * recomputed from history, and "earned" means the first game that met it.
 */

/** One finished game, oldest-to-newest order is not required. */
export interface BadgeGame {
  gameId: string;
  /** ISO timestamp. */
  finishedAt: string;
  winnerId: string | null;
  winThreshold: number;
  players: HighlightPlayer[];
  /** Cumulative totals per player after each round. */
  scoresByRound: Record<string, number[]>;
  /** Each round's score per player. */
  deltasByRound: Record<string, number[]>;
  /** Blitz pile left per round; null for typed round totals. */
  blitzByRound: Record<string, (number | null)[]>;
}

export const BADGES = [
  { id: "first_win", icon: "🏆", name: "First win", hint: "Win a game" },
  {
    id: "tornado",
    icon: "🌪️",
    name: "Tornado",
    hint: "Win from dead last while the leader falls to last",
  },
  {
    id: "u_turn",
    icon: "↩️",
    name: "U-turn",
    hint: "Go from last to first in one round",
  },
  {
    id: "short_fuse",
    icon: "🧨",
    name: "Short fuse",
    hint: "Win a full game in four rounds or fewer",
  },
  {
    id: "snipe",
    icon: "🎯",
    name: "Snipe",
    hint: "Be the only one to score in a round",
  },
  {
    id: "triple_blitz",
    icon: "⚡",
    name: "Triple blitz",
    hint: "Blitz three rounds in a row",
  },
  {
    id: "comeback",
    icon: "🔄",
    name: "Comeback kid",
    hint: "Win after trailing by 15 or more",
  },
  {
    id: "wire_to_wire",
    icon: "🚂",
    name: "Wire to wire",
    hint: "Lead after every round and win",
  },
  {
    id: "photo_finish",
    icon: "📸",
    name: "Photo finish",
    hint: "Win by 5 points or fewer",
  },
  {
    id: "heartbreaker",
    icon: "💔",
    name: "Heartbreaker",
    hint: "Lose by 5 points or fewer",
  },
  {
    id: "bounce_back",
    icon: "🦘",
    name: "Bounce back",
    hint: "Win the game right after a loss",
  },
  {
    id: "shortcoming",
    icon: "🕳️",
    name: "Shortcoming",
    hint: "Finish a game below zero",
  },
  {
    id: "first_blitz",
    icon: "✨",
    name: "First blitz",
    hint: "Empty your Blitz pile",
  },
  {
    id: "blitzes_100",
    icon: "💯",
    name: "Blitz century",
    hint: "Empty your Blitz pile 100 times",
  },
  { id: "games_10", icon: "🃏", name: "Regular", hint: "Finish 10 games" },
  { id: "games_100", icon: "🎴", name: "Centurion", hint: "Finish 100 games" },
  { id: "wins_10", icon: "🥇", name: "Ten-time winner", hint: "Win 10 games" },
  { id: "wins_50", icon: "👑", name: "Dynasty", hint: "Win 50 games" },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];
export type Badge = (typeof BADGES)[number];

export interface BadgeProgress {
  badge: Badge;
  /** Times earned; milestones count once. Zero means still locked. */
  count: number;
  /** The game that first earned it. */
  firstGameId: string | null;
  firstAt: string | null;
}

const MILESTONES: {
  id: BadgeId;
  stat: "wins" | "games" | "blitzes";
  at: number;
}[] = [
  { id: "first_win", stat: "wins", at: 1 },
  { id: "wins_10", stat: "wins", at: 10 },
  { id: "wins_50", stat: "wins", at: 50 },
  { id: "games_10", stat: "games", at: 10 },
  { id: "games_100", stat: "games", at: 100 },
  { id: "first_blitz", stat: "blitzes", at: 1 },
  { id: "blitzes_100", stat: "blitzes", at: 100 },
];

/** The sole player in last after a round, or null when it is shared. */
function soleLast(game: BadgeGame, round: number): string | null {
  let worst = Infinity;
  let last: string | null = null;
  for (const p of game.players) {
    const score = game.scoresByRound[p.id]?.[round] ?? 0;
    if (score < worst) {
      worst = score;
      last = p.id;
    } else if (score === worst) {
      last = null;
    }
  }
  return last;
}

/**
 * Moment badges the player earned in one game. The game page lists one
 * example of each moment, so moments several players can share (Snipe,
 * Triple blitz, U-turn, Shortcoming, Heartbreaker) are checked for this
 * player directly; the winner-only ones come from the shared detectors.
 */
export function gameMomentBadges(game: BadgeGame, playerId: string): BadgeId[] {
  const { winnerId } = game;
  const totals = game.scoresByRound[playerId];
  if (!winnerId || !totals?.length) return [];
  const earned = new Set<BadgeId>();
  const series = {
    players: game.players,
    winnerId,
    scoresByRound: game.scoresByRound,
  };
  const roundCount = totals.length;
  const finalRound = roundCount - 1;

  if (playerId === winnerId) {
    for (const moment of findNamedMoments({
      ...series,
      winThreshold: game.winThreshold,
    })) {
      if (moment.kind === "tornado" || moment.kind === "short_fuse") {
        earned.add(moment.kind);
      }
    }
    for (const highlight of findGameHighlights({
      ...series,
      deltasByRound: game.deltasByRound,
      blitzByRound: game.blitzByRound,
    })) {
      if (
        highlight.kind === "comeback" ||
        highlight.kind === "wire_to_wire" ||
        highlight.kind === "photo_finish"
      ) {
        earned.add(highlight.kind);
      }
    }
  }

  // Snipe: the only one to score in a round while everyone else went negative.
  if (game.players.length >= 3) {
    for (let r = 0; r < roundCount; r++) {
      const mine = game.deltasByRound[playerId]?.[r] ?? 0;
      const othersNegative = game.players.every(
        (p) => p.id === playerId || (game.deltasByRound[p.id]?.[r] ?? 0) < 0,
      );
      if (mine > 0 && othersNegative) {
        earned.add("snipe");
        break;
      }
    }
  }

  let run = 0;
  for (const left of game.blitzByRound[playerId] ?? []) {
    run = left === 0 ? run + 1 : 0;
    if (run >= MIN_BLITZ_STREAK) earned.add("triple_blitz");
  }

  // U-turn: alone in last before a round, alone in first after it.
  if (game.players.length >= 3) {
    for (let r = 1; r < roundCount; r++) {
      if (
        soleLast(game, r - 1) === playerId &&
        soleLeader(game.players, game.scoresByRound, r) === playerId
      ) {
        earned.add("u_turn");
        break;
      }
    }
  }

  if (totals[finalRound] < 0) earned.add("shortcoming");

  // Heartbreaker: the best non-winner, within a photo finish of the winner.
  // A points tie broken on the Blitz pile counts, at a margin of zero.
  if (playerId !== winnerId) {
    const bestOther = Math.max(
      ...game.players
        .filter((p) => p.id !== winnerId)
        .map((p) => game.scoresByRound[p.id]?.[finalRound] ?? 0),
    );
    const winnerFinal = game.scoresByRound[winnerId]?.[finalRound] ?? 0;
    if (
      totals[finalRound] === bestOther &&
      winnerFinal - bestOther <= PHOTO_FINISH_MAX_MARGIN
    ) {
      earned.add("heartbreaker");
    }
  }

  return BADGES.map((b) => b.id).filter((id) => earned.has(id));
}

/** Every badge with the player's progress, in catalog order. */
export function computeBadges(
  games: BadgeGame[],
  playerId: string,
): BadgeProgress[] {
  const ordered = [...games].sort(
    (a, b) =>
      a.finishedAt.localeCompare(b.finishedAt) ||
      a.gameId.localeCompare(b.gameId),
  );
  const progress = new Map<BadgeId, BadgeProgress>(
    BADGES.map((badge) => [
      badge.id,
      { badge, count: 0, firstGameId: null, firstAt: null },
    ]),
  );
  const award = (id: BadgeId, game: BadgeGame) => {
    const entry = progress.get(id)!;
    entry.count++;
    entry.firstGameId ??= game.gameId;
    entry.firstAt ??= game.finishedAt;
  };

  const totals = { wins: 0, games: 0, blitzes: 0 };
  let lostLast = false;
  for (const game of ordered) {
    if (!game.players.some((p) => p.id === playerId)) continue;
    for (const id of gameMomentBadges(game, playerId)) award(id, game);

    const before = { ...totals };
    totals.games++;
    if (game.winnerId === playerId) totals.wins++;
    totals.blitzes += (game.blitzByRound[playerId] ?? []).filter(
      (left) => left === 0,
    ).length;
    for (const m of MILESTONES) {
      if (before[m.stat] < m.at && totals[m.stat] >= m.at) award(m.id, game);
    }

    // Games without a recorded winner don't break or start a bounce back.
    if (game.winnerId) {
      if (lostLast && game.winnerId === playerId) award("bounce_back", game);
      lostLast = game.winnerId !== playerId;
    }
  }
  return [...progress.values()];
}

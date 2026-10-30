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
 * milestones count games, wins and blitzes through bronze, silver and gold.
 * Nothing is stored: badges are recomputed from history, and "earned" means
 * the first game that met it.
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

/** Badge groups, in catalog order, with a line on what ties each together. */
export const BADGE_FAMILIES = [
  {
    id: "milestones",
    name: "Milestones",
    blurb: "Bronze, silver and gold, as your wins, games and blitzes add up.",
  },
  {
    id: "wins",
    name: "Ways to win",
    blurb: "Earned each time you win a game in a particular way.",
  },
  {
    id: "rounds",
    name: "Big rounds",
    blurb: "Earned each game with a standout round or run of rounds.",
  },
  {
    id: "toughLuck",
    name: "Tough luck",
    blurb: "Earned the hard way. Wear them with pride.",
  },
] as const;

export type BadgeFamilyId = (typeof BADGE_FAMILIES)[number]["id"];

/**
 * Every badge, in catalog order. `hint` is the short line on cards and
 * `rule` is the full "how to earn it" shown in the badge catalogue.
 */
export const BADGES = [
  {
    id: "winner",
    icon: "🏆",
    name: "Winner",
    family: "milestones",
    hint: "Win 1, 10 and 50 games",
    rule: "Win 1 game for bronze, 10 for silver and 50 for gold.",
  },
  {
    id: "regular",
    icon: "🃏",
    name: "Regular",
    family: "milestones",
    hint: "Finish 10, 50 and 100 games",
    rule: "Play 10 games to the finish for bronze, 50 for silver and 100 for gold, win or lose.",
  },
  {
    id: "blitzer",
    icon: "✨",
    name: "Blitzer",
    family: "milestones",
    hint: "Blitz 1, 25 and 100 times",
    rule: "Empty your Blitz pile in 1 round for bronze, 25 for silver and 100 for gold.",
  },
  {
    id: "comeback",
    icon: "🔄",
    name: "Comeback kid",
    family: "wins",
    hint: "Win from way behind",
    rule: "Win a game after being 15 or more points behind the leader at the end of a round. A Tornado counts too: win after being alone in last, while the player leading alone at that moment finishes alone in last (three or more players).",
  },
  {
    id: "wire_to_wire",
    icon: "🚂",
    name: "Wire to wire",
    family: "wins",
    hint: "Lead after every round and win",
    rule: "Win a game of three or more rounds while leading on your own after every round.",
  },
  {
    id: "photo_finish",
    icon: "📸",
    name: "Photo finish",
    family: "wins",
    hint: "Win by 5 points or fewer",
    rule: "Win a game by 5 points or fewer over the runner-up.",
  },
  {
    id: "short_fuse",
    icon: "🧨",
    name: "Short fuse",
    family: "wins",
    hint: "Win a full game in four rounds or fewer",
    rule: "Win a game to 75 points or more in four rounds or fewer.",
  },
  {
    id: "u_turn",
    icon: "↩️",
    name: "U-turn",
    family: "rounds",
    hint: "Go from last to first in one round",
    rule: "Go from alone in last place to alone in first place in a single round. Needs three or more players.",
  },
  {
    id: "snipe",
    icon: "🎯",
    name: "Snipe",
    family: "rounds",
    hint: "Be the only one to score in a round",
    rule: "Score in a round where every other player goes negative. Needs three or more players.",
  },
  {
    id: "triple_blitz",
    icon: "⚡",
    name: "Triple blitz",
    family: "rounds",
    hint: "Blitz three rounds in a row",
    rule: "Empty your Blitz pile in three rounds in a row in one game.",
  },
  {
    id: "heartbreaker",
    icon: "💔",
    name: "Heartbreaker",
    family: "toughLuck",
    hint: "Lose by 5 points or fewer",
    rule: "Finish as runner-up, 5 points or fewer behind the winner.",
  },
  {
    id: "shortcoming",
    icon: "🕳️",
    name: "Shortcoming",
    family: "toughLuck",
    hint: "Finish a game below zero",
    rule: "End a game with a total score below zero.",
  },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];
export type Badge = (typeof BADGES)[number];

export const BADGE_TIERS = ["Bronze", "Silver", "Gold"] as const;

type MilestoneStat = "wins" | "games" | "blitzes";

/** Milestone badges: the running total each tier needs, bronze first. */
export const MILESTONES: Partial<
  Record<BadgeId, { stat: MilestoneStat; levels: readonly number[] }>
> = {
  winner: { stat: "wins", levels: [1, 10, 50] },
  regular: { stat: "games", levels: [10, 50, 100] },
  blitzer: { stat: "blitzes", levels: [1, 25, 100] },
};

export interface BadgeProgress {
  badge: Badge;
  /** Times earned, or tiers reached for milestones. Zero means locked. */
  count: number;
  /** The game that first earned it. */
  firstGameId: string | null;
  firstAt: string | null;
  /** Milestones only: each tier reached, bronze first. */
  tiers: { gameId: string; at: string }[];
  /** Milestones only: the running total; null for other badges. */
  total: number | null;
}

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
      // A Tornado is the wildest comeback, so it earns Comeback kid.
      if (moment.kind === "tornado") earned.add("comeback");
      if (moment.kind === "short_fuse") earned.add("short_fuse");
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
      {
        badge,
        count: 0,
        firstGameId: null,
        firstAt: null,
        tiers: [],
        total: MILESTONES[badge.id] ? 0 : null,
      },
    ]),
  );
  const award = (id: BadgeId, game: BadgeGame) => {
    const entry = progress.get(id)!;
    entry.count++;
    entry.firstGameId ??= game.gameId;
    entry.firstAt ??= game.finishedAt;
  };

  const totals: Record<MilestoneStat, number> = {
    wins: 0,
    games: 0,
    blitzes: 0,
  };
  for (const game of ordered) {
    if (!game.players.some((p) => p.id === playerId)) continue;
    for (const id of gameMomentBadges(game, playerId)) award(id, game);

    const before = { ...totals };
    totals.games++;
    if (game.winnerId === playerId) totals.wins++;
    totals.blitzes += (game.blitzByRound[playerId] ?? []).filter(
      (left) => left === 0,
    ).length;
    for (const [id, m] of Object.entries(MILESTONES) as [
      BadgeId,
      NonNullable<(typeof MILESTONES)[BadgeId]>,
    ][]) {
      for (const level of m.levels) {
        if (before[m.stat] < level && totals[m.stat] >= level) {
          award(id, game);
          progress.get(id)!.tiers.push({
            gameId: game.gameId,
            at: game.finishedAt,
          });
        }
      }
    }
  }
  for (const [id, m] of Object.entries(MILESTONES)) {
    progress.get(id as BadgeId)!.total = totals[m.stat];
  }
  return [...progress.values()];
}

/** The tier name for a milestone that reached `count` tiers. */
export const tierName = (count: number) => BADGE_TIERS[count - 1] ?? null;

/**
 * Badges a game earned the player for the first time, including milestone
 * tiers reached in it, with the highest tier named.
 */
export function badgesEarnedInGame(
  badges: BadgeProgress[],
  gameId: string,
): { badge: Badge; tier: string | null }[] {
  return badges.flatMap<{ badge: Badge; tier: string | null }>((progress) => {
    if (progress.total === null) {
      return progress.firstGameId === gameId
        ? [{ badge: progress.badge, tier: null }]
        : [];
    }
    const reached = progress.tiers.findLastIndex((t) => t.gameId === gameId);
    return reached >= 0
      ? [{ badge: progress.badge, tier: tierName(reached + 1) }]
      : [];
  });
}

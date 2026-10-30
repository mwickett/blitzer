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

/** Badge groups, in catalog order, with a line on what ties each together. */
export const BADGE_FAMILIES = [
  {
    id: "milestones",
    name: "Milestones",
    blurb: "Earned once, as your games, wins and blitzes add up.",
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
    id: "first_win",
    icon: "🏆",
    name: "First win",
    family: "milestones",
    hint: "Win a game",
    rule: "Win any game you play to the finish.",
  },
  {
    id: "wins_10",
    icon: "🥇",
    name: "Ten-time winner",
    family: "milestones",
    hint: "Win 10 games",
    rule: "Win 10 games in total.",
  },
  {
    id: "wins_50",
    icon: "👑",
    name: "Dynasty",
    family: "milestones",
    hint: "Win 50 games",
    rule: "Win 50 games in total.",
  },
  {
    id: "games_10",
    icon: "🃏",
    name: "Regular",
    family: "milestones",
    hint: "Finish 10 games",
    rule: "Play 10 games to the finish, win or lose.",
  },
  {
    id: "games_100",
    icon: "🎴",
    name: "Centurion",
    family: "milestones",
    hint: "Finish 100 games",
    rule: "Play 100 games to the finish, win or lose.",
  },
  {
    id: "first_blitz",
    icon: "✨",
    name: "First blitz",
    family: "milestones",
    hint: "Empty your Blitz pile",
    rule: "Empty your Blitz pile in a round. That's calling Blitz!",
  },
  {
    id: "blitzes_100",
    icon: "💯",
    name: "Blitz century",
    family: "milestones",
    hint: "Empty your Blitz pile 100 times",
    rule: "Empty your Blitz pile in 100 rounds in total.",
  },
  {
    id: "tornado",
    icon: "🌪️",
    name: "Tornado",
    family: "wins",
    hint: "Win from dead last while the leader falls to last",
    rule: "Be alone in last place after a round, then win the game, while the player leading alone at that moment finishes alone in last. Needs three or more players.",
  },
  {
    id: "comeback",
    icon: "🔄",
    name: "Comeback kid",
    family: "wins",
    hint: "Win after trailing by 15 or more",
    rule: "Win a game after being 15 or more points behind the leader at the end of a round.",
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
    id: "bounce_back",
    icon: "🦘",
    name: "Bounce back",
    family: "wins",
    hint: "Win the game right after a loss",
    rule: "Win the next game with a recorded winner after losing one.",
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

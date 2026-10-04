import {
  findGameHighlights,
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

/** Moment badges the player starred in during one game. */
export function gameMomentBadges(game: BadgeGame, playerId: string): BadgeId[] {
  const { winnerId } = game;
  if (!winnerId || !game.scoresByRound[playerId]?.length) return [];
  const earned = new Set<BadgeId>();
  const series = {
    players: game.players,
    winnerId,
    scoresByRound: game.scoresByRound,
  };
  for (const moment of findNamedMoments({
    ...series,
    winThreshold: game.winThreshold,
  })) {
    if (moment.playerId === playerId) earned.add(moment.kind);
  }
  for (const highlight of findGameHighlights({
    ...series,
    deltasByRound: game.deltasByRound,
    blitzByRound: game.blitzByRound,
  })) {
    switch (highlight.kind) {
      case "lone_survivor":
        if (highlight.playerId === playerId) earned.add("snipe");
        break;
      case "blitz_streak":
        if (highlight.playerId === playerId) earned.add("triple_blitz");
        break;
      case "comeback":
      case "wire_to_wire":
        if (highlight.playerId === playerId) earned.add(highlight.kind);
        break;
      case "photo_finish": {
        if (highlight.playerId === playerId) {
          earned.add("photo_finish");
          break;
        }
        // Runner-up: nobody else finished between them and the winner.
        const last: number = game.scoresByRound[winnerId].length - 1;
        const mine: number = game.scoresByRound[playerId][last];
        const ahead: HighlightPlayer[] = game.players.filter(
          (p) => (game.scoresByRound[p.id]?.[last] ?? 0) > mine,
        );
        if (ahead.length === 1 && ahead[0].id === winnerId)
          earned.add("heartbreaker");
        break;
      }
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

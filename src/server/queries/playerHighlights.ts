import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";

type Db = Pick<PrismaClient, "$queryRaw">;

/** Highlights read the caller's most recent completed games, never full history. */
export const HIGHLIGHT_GAME_LIMIT = 200;

export type GameResult = "W" | "L";

export type HighlightRival = {
  name: string;
  gamesPlayed: number;
  /** Games this player won while the rival was at the table. */
  wins: number;
  /** Games the rival won while this player was at the table. */
  losses: number;
};

export type HighlightGame = {
  gameId: string;
  finishedAt: Date;
  /** Final lead (positive) or deficit (negative) against the best opponent. */
  finalMargin: number;
  /** Largest deficit to the leading opponent after any round. */
  maxDeficit: number;
  rounds: number;
};

export type PlayerHighlights = {
  sampledGames: number;
  /** Newest first, completed games with a recorded winner. */
  recentResults: GameResult[];
  currentStreak: { result: GameResult; length: number } | null;
  longestWinStreak: number;
  rivals: {
    mostPlayed: HighlightRival | null;
    nemesis: HighlightRival | null;
    favoriteOpponent: HighlightRival | null;
  };
  biggestComeback: HighlightGame | null;
  closestWin: HighlightGame | null;
  biggestWin: HighlightGame | null;
  heartbreaker: HighlightGame | null;
  blitzStreak: { gameId: string; rounds: number } | null;
};

export const EMPTY_HIGHLIGHTS: PlayerHighlights = {
  sampledGames: 0,
  recentResults: [],
  currentStreak: null,
  longestWinStreak: 0,
  rivals: { mostPlayed: null, nemesis: null, favoriteOpponent: null },
  biggestComeback: null,
  closestWin: null,
  biggestWin: null,
  heartbreaker: null,
  blitzStreak: null,
};

type Count = bigint | number;

type ResultRow = { id: string; winnerId: string | null; finishedAt: Date };
type RivalRow = { name: string | null; gamesPlayed: Count; wins: Count; losses: Count };
type MarginRow = {
  gameId: string;
  winnerId: string | null;
  finishedAt: Date;
  maxDeficit: Count;
  finalMargin: Count;
  rounds: Count;
};
type StreakRow = { gameId: string; rounds: Count };

const recentGames = (userId: string) => Prisma.sql`
  SELECT g.id, g."winnerId", COALESCE(g.ended_at, g.created_at) AS "finishedAt"
  FROM "Game" g
  WHERE g.is_finished AND g.started_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM "GamePlayers" p WHERE p."gameId" = g.id AND p."userId" = ${userId})
  ORDER BY "finishedAt" DESC, g.id DESC
  LIMIT ${HIGHLIGHT_GAME_LIMIT}
`;

function streaks(results: GameResult[]) {
  let longestWinStreak = 0;
  let run = 0;
  for (const result of results) {
    run = result === "W" ? run + 1 : 0;
    longestWinStreak = Math.max(longestWinStreak, run);
  }
  const first = results[0];
  if (!first) return { currentStreak: null, longestWinStreak };
  const length = results.findIndex((result) => result !== first);
  return {
    currentStreak: { result: first, length: length === -1 ? results.length : length },
    longestWinStreak,
  };
}

function pickBy<T>(rows: T[], score: (row: T) => number) {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const row of rows) {
    const value = score(row);
    if (value > bestScore) {
      best = row;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Memorable moments for one player: form, rivals, comebacks and streaks.
 * Every query is bounded to the caller's most recent completed games and
 * aggregated in PostgreSQL, so cost does not grow with a player's lifetime.
 */
export async function getPlayerHighlightsForUser(
  userId: string,
  db: Db = prisma,
): Promise<PlayerHighlights> {
  const score = Prisma.raw(ROUND_SCORE_SQL);
  const [resultRows, rivalRows, marginRows, streakRows] = await Promise.all([
    db.$queryRaw<ResultRow[]>(recentGames(userId)),
    db.$queryRaw<RivalRow[]>(Prisma.sql`
      WITH recent AS (${recentGames(userId)})
      SELECT COALESCE(u.username, gu.name) AS name,
        COUNT(*) AS "gamesPlayed",
        COUNT(*) FILTER (WHERE r."winnerId" = ${userId}) AS wins,
        COUNT(*) FILTER (WHERE r."winnerId" = COALESCE(p."userId", p."guestId")) AS losses
      FROM recent r
      JOIN "GamePlayers" p ON p."gameId" = r.id
      LEFT JOIN "User" u ON u.id = p."userId"
      LEFT JOIN "GuestUser" gu ON gu.id = p."guestId"
      WHERE COALESCE(p."userId", p."guestId") IS NOT NULL
        AND p."userId" IS DISTINCT FROM ${userId}
      GROUP BY COALESCE(p."userId", p."guestId"), COALESCE(u.username, gu.name)
      ORDER BY "gamesPlayed" DESC, name
      LIMIT 25
    `),
    db.$queryRaw<MarginRow[]>(Prisma.sql`
      WITH recent AS (${recentGames(userId)}),
      round_points AS (
        SELECT rd."gameId", rd.round, COALESCE(s."userId", s."guestId") AS player,
          SUM(${score}) AS points
        FROM recent r
        JOIN "Round" rd ON rd."gameId" = r.id
        JOIN "Score" s ON s."roundId" = rd.id
        WHERE COALESCE(s."userId", s."guestId") IS NOT NULL
        GROUP BY rd."gameId", rd.round, COALESCE(s."userId", s."guestId")
      ),
      running AS (
        SELECT "gameId", round, player,
          SUM(points) OVER (PARTITION BY "gameId", player ORDER BY round) AS total
        FROM round_points
      ),
      board AS (
        SELECT "gameId", round,
          MAX(total) FILTER (WHERE player = ${userId}) AS mine,
          MAX(total) FILTER (WHERE player <> ${userId}) AS rival
        FROM running
        GROUP BY "gameId", round
      )
      SELECT b."gameId", r."winnerId", r."finishedAt",
        MAX(b.rival - b.mine) AS "maxDeficit",
        (ARRAY_AGG(b.mine - b.rival ORDER BY b.round DESC))[1] AS "finalMargin",
        COUNT(*) AS rounds
      FROM board b
      JOIN recent r ON r.id = b."gameId"
      WHERE b.mine IS NOT NULL AND b.rival IS NOT NULL
      GROUP BY b."gameId", r."winnerId", r."finishedAt"
    `),
    db.$queryRaw<StreakRow[]>(Prisma.sql`
      WITH recent AS (${recentGames(userId)}),
      mine AS (
        SELECT rd."gameId", s."blitzPileRemaining" = 0 AS blitzed,
          ROW_NUMBER() OVER (PARTITION BY rd."gameId" ORDER BY rd.round)
            - ROW_NUMBER() OVER (PARTITION BY rd."gameId", s."blitzPileRemaining" = 0 ORDER BY rd.round) AS run
        FROM recent r
        JOIN "Round" rd ON rd."gameId" = r.id
        JOIN "Score" s ON s."roundId" = rd.id AND s."userId" = ${userId}
      )
      SELECT "gameId", COUNT(*) AS rounds
      FROM mine
      WHERE blitzed
      GROUP BY "gameId", run
      ORDER BY rounds DESC, "gameId"
      LIMIT 1
    `),
  ]);

  const recentResults = resultRows
    .filter((row) => row.winnerId)
    .map((row): GameResult => (row.winnerId === userId ? "W" : "L"));

  const rivals = rivalRows.map((row) => ({
    name: row.name ?? "Unknown player",
    gamesPlayed: Number(row.gamesPlayed),
    wins: Number(row.wins),
    losses: Number(row.losses),
  }));
  const nemesis = pickBy(rivals.filter((rival) => rival.losses > 0 && rival.losses >= rival.wins),
    (rival) => rival.losses * 1000 - rival.wins);
  const favoriteOpponent = pickBy(rivals.filter((rival) => rival.wins > 0 && rival.wins > rival.losses),
    (rival) => rival.wins * 1000 - rival.losses);

  const games = marginRows.map((row) => ({
    game: {
      gameId: row.gameId,
      finishedAt: new Date(row.finishedAt),
      finalMargin: Number(row.finalMargin),
      maxDeficit: Math.max(0, Number(row.maxDeficit)),
      rounds: Number(row.rounds),
    },
    won: row.winnerId === userId,
    lost: row.winnerId !== null && row.winnerId !== userId,
  }));
  const wins = games.filter((entry) => entry.won).map((entry) => entry.game);
  const losses = games.filter((entry) => entry.lost).map((entry) => entry.game);
  // Ties go to the newest game, so highlights refresh as new memories happen.
  const newest = (game: HighlightGame) => game.finishedAt.getTime() / 1e15;

  const comeback = pickBy(wins.filter((game) => game.maxDeficit > 0), (game) => game.maxDeficit + newest(game));
  const streak = streakRows[0];

  return {
    sampledGames: resultRows.length,
    recentResults: recentResults.slice(0, 10),
    ...streaks(recentResults),
    rivals: { mostPlayed: rivals[0] ?? null, nemesis, favoriteOpponent },
    biggestComeback: comeback,
    closestWin: pickBy(wins.filter((game) => game.finalMargin > 0), (game) => -game.finalMargin + newest(game)),
    biggestWin: pickBy(wins.filter((game) => game.finalMargin > 0), (game) => game.finalMargin + newest(game)),
    heartbreaker: pickBy(losses.filter((game) => game.finalMargin < 0), (game) => game.finalMargin + newest(game)),
    blitzStreak: streak && Number(streak.rounds) >= 2
      ? { gameId: streak.gameId, rounds: Number(streak.rounds) }
      : null,
  };
}

/** Highlights for a Clerk identity; an unprovisioned caller has no history yet. */
export async function getPlayerHighlightsForClerkUser(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true },
  });
  return user ? getPlayerHighlightsForUser(user.id) : EMPTY_HIGHLIGHTS;
}

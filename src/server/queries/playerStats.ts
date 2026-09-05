import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { LOBBY_MAX_AGE_MS } from "@/lib/lobbies";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";

type Db = Pick<PrismaClient, "$queryRaw">;

export const EMPTY_GAME_STATS = {
  gamesCount: 0,
  inProgressGames: 0,
  completedGames: 0,
  endedGames: 0,
  waitingLobbies: 0,
  expiredLobbies: 0,
  winCount: 0,
  lossCount: 0,
  decidedGames: 0,
  winRate: 0,
};

export const EMPTY_ROUND_STATS = {
  totalRounds: 0,
  totalBlitzes: 0,
  totalCardsPlayed: 0,
  avgCardsPlayed: 0,
  avgBlitzRemaining: 0,
  blitzPercentage: 0,
  highestScore: 0,
  lowestScore: 0,
  cumulativeScore: 0,
};

/** Played games have started. Win rate includes completed games with a winner. */
export async function getGameStatsForUser(
  userId: string,
  db: Db = prisma,
  now = new Date(),
) {
  const [row] = await db.$queryRaw<Array<Record<Exclude<keyof typeof EMPTY_GAME_STATS, "decidedGames" | "winRate">, bigint>>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE started_at IS NOT NULL) AS "gamesCount",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND NOT is_finished AND ended_at IS NULL) AS "inProgressGames",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished) AS "completedGames",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND NOT is_finished AND ended_at IS NOT NULL) AS "endedGames",
      COUNT(*) FILTER (WHERE kind = 'PICKUP' AND started_at IS NULL AND NOT is_finished
        AND created_at >= ${new Date(now.getTime() - LOBBY_MAX_AGE_MS)}) AS "waitingLobbies",
      COUNT(*) FILTER (WHERE kind = 'PICKUP' AND started_at IS NULL AND NOT is_finished
        AND created_at < ${new Date(now.getTime() - LOBBY_MAX_AGE_MS)}) AS "expiredLobbies",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished AND "winnerId" = ${userId}) AS "winCount",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished AND "winnerId" != ${userId}) AS "lossCount"
    FROM "Game" g
    WHERE EXISTS (SELECT 1 FROM "GamePlayers" p WHERE p."gameId" = g.id AND p."userId" = ${userId})
  `);
  const counts = {
    gamesCount: Number(row?.gamesCount ?? 0),
    inProgressGames: Number(row?.inProgressGames ?? 0),
    completedGames: Number(row?.completedGames ?? 0),
    endedGames: Number(row?.endedGames ?? 0),
    waitingLobbies: Number(row?.waitingLobbies ?? 0),
    expiredLobbies: Number(row?.expiredLobbies ?? 0),
    winCount: Number(row?.winCount ?? 0),
    lossCount: Number(row?.lossCount ?? 0),
  };
  const decidedGames = counts.winCount + counts.lossCount;
  return { ...counts, decidedGames, winRate: decidedGames ? counts.winCount / decidedGames * 100 : 0 };
}

/** One aggregate row, independent of the length of a player's score history. */
export async function getRoundStatsForUser(userId: string, db: Db = prisma) {
  type Row = { [K in Exclude<keyof typeof EMPTY_ROUND_STATS, "blitzPercentage">]: number | bigint | null };
  const [row] = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT COUNT(*) AS "totalRounds",
      COUNT(*) FILTER (WHERE "blitzPileRemaining" = 0) AS "totalBlitzes",
      SUM("totalCardsPlayed") AS "totalCardsPlayed",
      AVG("totalCardsPlayed")::float8 AS "avgCardsPlayed",
      AVG("blitzPileRemaining")::float8 AS "avgBlitzRemaining",
      MAX(${Prisma.raw(ROUND_SCORE_SQL)}) AS "highestScore",
      MIN(${Prisma.raw(ROUND_SCORE_SQL)}) AS "lowestScore",
      SUM(${Prisma.raw(ROUND_SCORE_SQL)}) AS "cumulativeScore"
    FROM "Score"
    WHERE "userId" = ${userId}
  `);
  const totalRounds = Number(row?.totalRounds ?? 0);
  const totalBlitzes = Number(row?.totalBlitzes ?? 0);
  return {
    totalRounds,
    totalBlitzes,
    totalCardsPlayed: Number(row?.totalCardsPlayed ?? 0),
    avgCardsPlayed: Number(row?.avgCardsPlayed ?? 0),
    avgBlitzRemaining: Number(row?.avgBlitzRemaining ?? 0),
    blitzPercentage: totalRounds ? totalBlitzes / totalRounds * 100 : 0,
    highestScore: Number(row?.highestScore ?? 0),
    lowestScore: Number(row?.lowestScore ?? 0),
    cumulativeScore: Number(row?.cumulativeScore ?? 0),
  };
}

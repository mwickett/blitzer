import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { requireAuthContext } from "../mutations/common";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";
import { getRoundStatsForUser } from "./playerStats";

// Canonical single-round score expression — see ROUND_SCORE_SQL
const scoreExpr = Prisma.raw(ROUND_SCORE_SQL);

// The ...ForUser variants take an explicit internal user id and an optional
// Prisma client, so callers that already resolved the user don't repeat the lookup. The
// dashboard entry resolves the authenticated user and delegates.

type Db = PrismaClient | typeof prisma;

export type BattingAverageStats = {
  totalHandsPlayed: number;
  totalHandsWon: number;
  battingAverage: string;
};

export type ScoreExtreme = {
  score: number;
  totalCardsPlayed: number;
  blitzPileRemaining: number;
};

export type ScoreExtremes = {
  highest: ScoreExtreme | null;
  lowest: ScoreExtreme | null;
};

export type GameRoundCount = {
  id: string;
  roundCount: number;
};

export type GameRoundExtremes = {
  longest: GameRoundCount | null;
  shortest: GameRoundCount | null;
};

export type DashboardStats = {
  battingAverage: BattingAverageStats;
  scoreExtremes: ScoreExtremes;
  cumulativeScore: number;
  gameRoundExtremes: GameRoundExtremes;
};

// Highest / lowest single-round score, each fetched with ORDER BY + LIMIT 1
// so the database does the aggregation instead of JS reducing every row
export async function getHighestAndLowestScoreForUser(
  userId: string,
  db: Db = prisma
): Promise<ScoreExtremes> {
  const [highestRows, lowestRows] = await Promise.all([
    db.$queryRaw<ScoreExtreme[]>(
      Prisma.sql`
        SELECT
          ${scoreExpr} as score,
          "totalCardsPlayed",
          "blitzPileRemaining"
        FROM "Score"
        WHERE "userId" = ${userId}
        ORDER BY ${scoreExpr} DESC, "created_at" DESC, id DESC
        LIMIT 1
      `
    ),
    db.$queryRaw<ScoreExtreme[]>(
      Prisma.sql`
        SELECT
          ${scoreExpr} as score,
          "totalCardsPlayed",
          "blitzPileRemaining"
        FROM "Score"
        WHERE "userId" = ${userId}
        ORDER BY ${scoreExpr} ASC, "created_at" DESC, id DESC
        LIMIT 1
      `
    ),
  ]);

  const highest = highestRows[0] ?? null;
  const lowest = lowestRows[0] ?? null;

  if (!highest) {
    return { highest: null, lowest: null };
  }

  // A lone score (or an all-equal history) has no distinct lowest
  if (!lowest || lowest.score === highest.score) {
    return { highest, lowest: null };
  }

  return { highest, lowest };
}

// Longest / shortest finished game by round count, aggregated with GROUP BY
// instead of loading every game and its rounds into memory
export async function getLongestAndShortestGamesByRoundsForUser(
  userId: string,
  db: Db = prisma
): Promise<GameRoundExtremes> {
  const roundCountExtreme = (order: "asc" | "desc") =>
    db.round.groupBy({
      by: ["gameId"],
      where: {
        game: {
          isFinished: true,
          players: { some: { userId } },
        },
      },
      _count: { _all: true },
      orderBy: { _count: { gameId: order } },
      take: 1,
    });

  const [longestRows, shortestRows] = await Promise.all([
    roundCountExtreme("desc"),
    roundCountExtreme("asc"),
  ]);

  const toGame = (row?: { gameId: string; _count: { _all: number } }) =>
    row ? { id: row.gameId, roundCount: row._count._all } : null;

  return {
    longest: toGame(longestRows[0]),
    shortest: toGame(shortestRows[0]),
  };
}

export async function getDashboardStatsForUser(
  userId: string,
  db: Db = prisma
): Promise<DashboardStats> {
  const [roundStats, scoreExtremes, gameRoundExtremes] =
    await Promise.all([
      getRoundStatsForUser(userId, db),
      getHighestAndLowestScoreForUser(userId, db),
      getLongestAndShortestGamesByRoundsForUser(userId, db),
    ]);

  return {
    battingAverage: {
      totalHandsPlayed: roundStats.totalRounds,
      totalHandsWon: roundStats.totalBlitzes,
      battingAverage: (roundStats.blitzPercentage / 100).toFixed(3),
    },
    scoreExtremes,
    cumulativeScore: roundStats.cumulativeScore,
    gameRoundExtremes,
  };
}

export async function getDashboardStats() {
  const { prismaUserId } = await requireAuthContext("prismaId");
  return getDashboardStatsForUser(prismaUserId);
}

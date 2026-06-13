import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";
import {
  calculateCumulativeScore,
  ROUND_SCORE_SQL,
} from "@/lib/validation/gameRules";

// Canonical single-round score expression — see ROUND_SCORE_SQL
const scoreExpr = Prisma.raw(ROUND_SCORE_SQL);

// The ...ForUser variants take an explicit internal user id and an optional
// Prisma client, so callers that already resolved the user — or that read
// from the replica, like the AI tool layer — don't repeat the lookup. The
// zero-arg exports resolve the authenticated user and delegate.

type Db = PrismaClient | typeof prisma;

type ScoreExtreme = {
  score: number;
  totalCardsPlayed: number;
  blitzPileRemaining: number;
};

// Batting average
// Fetch players total rounds and rounds won
// This assumes that only one player blitzed per round (edge case)
export async function getPlayerBattingAverageForUser(
  userId: string,
  db: Db = prisma
) {
  const [totalHandsPlayed, totalHandsWon] = await Promise.all([
    db.score.count({
      where: {
        userId,
      },
    }),
    db.score.count({
      where: {
        userId,
        blitzPileRemaining: 0,
      },
    }),
  ]);

  const rawBattingAverage =
    totalHandsPlayed === 0 ? 0 : totalHandsWon / totalHandsPlayed;

  const battingAverage = rawBattingAverage.toFixed(3);

  return {
    totalHandsPlayed,
    totalHandsWon,
    battingAverage,
  };
}

export async function getPlayerBattingAverage() {
  return getPlayerBattingAverageForUser(await getUserIdFromAuth());
}

// Highest / lowest single-round score, each fetched with ORDER BY + LIMIT 1
// so the database does the aggregation instead of JS reducing every row
export async function getHighestAndLowestScoreForUser(
  userId: string,
  db: Db = prisma
) {
  const [highestRows, lowestRows] = await Promise.all([
    db.$queryRaw<ScoreExtreme[]>(
      Prisma.sql`
        SELECT
          ${scoreExpr} as score,
          "totalCardsPlayed",
          "blitzPileRemaining"
        FROM "Score"
        WHERE "userId" = ${userId}
        ORDER BY ${scoreExpr} DESC
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
        ORDER BY ${scoreExpr} ASC
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

export async function getHighestAndLowestScore() {
  return getHighestAndLowestScoreForUser(await getUserIdFromAuth());
}

// Cumulative score
export async function getCumulativeScoreForUser(
  userId: string,
  db: Db = prisma
) {
  const cumulativeScore = await db.score.aggregate({
    where: {
      userId,
    },
    _sum: {
      totalCardsPlayed: true,
      blitzPileRemaining: true,
    },
  });

  const totalCardsPlayed = cumulativeScore._sum.totalCardsPlayed;
  const blitzPileRemaining = cumulativeScore._sum.blitzPileRemaining;

  if (totalCardsPlayed === null || blitzPileRemaining === null) {
    return 0;
  }

  return calculateCumulativeScore({ totalCardsPlayed, blitzPileRemaining });
}

export async function getCumulativeScore() {
  return getCumulativeScoreForUser(await getUserIdFromAuth());
}

// Longest / shortest finished game by round count, aggregated with GROUP BY
// instead of loading every game and its rounds into memory
export async function getLongestAndShortestGamesByRoundsForUser(
  userId: string,
  db: Db = prisma
) {
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

export async function getLongestAndShortestGamesByRounds() {
  return getLongestAndShortestGamesByRoundsForUser(await getUserIdFromAuth());
}

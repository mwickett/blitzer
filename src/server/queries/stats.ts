import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";

type StatsDb = Pick<PrismaClient, "$queryRaw">;

type CountRow = {
  totalHandsPlayed: number | bigint;
  totalHandsWon: number | bigint;
};

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

type ScoreExtremeRow = ScoreExtreme & {
  id: string;
};

export type ScoreExtremes = {
  highest: ScoreExtreme | null;
  lowest: ScoreExtreme | null;
};

export type GameRoundCount = {
  id: string;
  roundCount: number;
  isFinished: boolean;
};

type GameRoundCountRow = {
  kind: "longest" | "shortest";
  id: string;
  roundCount: number | bigint;
  isFinished: boolean;
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

function scoreFromRow(row: ScoreExtremeRow): ScoreExtreme {
  return {
    score: row.score,
    totalCardsPlayed: row.totalCardsPlayed,
    blitzPileRemaining: row.blitzPileRemaining,
  };
}

function gameRoundCountFromRow(row: GameRoundCountRow): GameRoundCount {
  return {
    id: row.id,
    roundCount: Number(row.roundCount),
    isFinished: row.isFinished,
  };
}

export async function getPlayerBattingAverageForUser(
  id: string,
  db: StatsDb = prisma
): Promise<BattingAverageStats> {
  const rows = await db.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS "totalHandsPlayed",
      COUNT(*) FILTER (WHERE "blitzPileRemaining" = 0) AS "totalHandsWon"
    FROM "Score"
    WHERE "userId" = ${id}
  `);
  const row = rows[0] ?? { totalHandsPlayed: 0, totalHandsWon: 0 };
  const totalHandsPlayed = Number(row.totalHandsPlayed);
  const totalHandsWon = Number(row.totalHandsWon);
  const rawBattingAverage =
    totalHandsPlayed === 0 ? 0 : totalHandsWon / totalHandsPlayed;

  return {
    totalHandsPlayed,
    totalHandsWon,
    battingAverage: rawBattingAverage.toFixed(3),
  };
}

export async function getScoreExtremesForUser(
  id: string,
  db: StatsDb = prisma
): Promise<ScoreExtremes> {
  const [highestRows, lowestRows] = await Promise.all([
    db.$queryRaw<ScoreExtremeRow[]>(Prisma.sql`
      SELECT
        id,
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) AS score,
        "totalCardsPlayed",
        "blitzPileRemaining"
      FROM "Score"
      WHERE "userId" = ${id}
      ORDER BY ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) DESC, "created_at" DESC, id DESC
      LIMIT 1
    `),
    db.$queryRaw<ScoreExtremeRow[]>(Prisma.sql`
      SELECT
        id,
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) AS score,
        "totalCardsPlayed",
        "blitzPileRemaining"
      FROM "Score"
      WHERE "userId" = ${id}
      ORDER BY ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) ASC, "created_at" DESC, id DESC
      LIMIT 1
    `),
  ]);

  const highestRow = highestRows[0];
  const lowestRow = lowestRows[0];

  if (!highestRow) {
    return { highest: null, lowest: null };
  }

  return {
    highest: scoreFromRow(highestRow),
    lowest:
      lowestRow && lowestRow.id !== highestRow.id ? scoreFromRow(lowestRow) : null,
  };
}

export async function getCumulativeScoreForUser(
  id: string,
  db: StatsDb = prisma
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ totalScore: number | bigint }>>(Prisma.sql`
    SELECT COALESCE(SUM("totalCardsPlayed" - ("blitzPileRemaining" * 2)), 0) AS "totalScore"
    FROM "Score"
    WHERE "userId" = ${id}
  `);

  return Number(rows[0]?.totalScore ?? 0);
}

export async function getGameRoundExtremesForUser(
  id: string,
  db: StatsDb = prisma
): Promise<GameRoundExtremes> {
  const rows = await db.$queryRaw<GameRoundCountRow[]>(Prisma.sql`
    WITH user_games AS (
      SELECT
        g.id,
        g."is_finished" AS "isFinished",
        COUNT(r.id) AS "roundCount"
      FROM "Game" g
      INNER JOIN "GamePlayers" gp ON gp."gameId" = g.id
      LEFT JOIN "Round" r ON r."gameId" = g.id
      WHERE gp."userId" = ${id}
        AND g."is_finished" = true
      GROUP BY g.id, g."is_finished"
    )
    SELECT * FROM (
      SELECT 'longest'::text AS kind, id, "roundCount", "isFinished"
      FROM user_games
      ORDER BY "roundCount" DESC, id DESC
      LIMIT 1
    ) longest
    UNION ALL
    SELECT * FROM (
      SELECT 'shortest'::text AS kind, id, "roundCount", "isFinished"
      FROM user_games
      WHERE "roundCount" > 0
      ORDER BY "roundCount" ASC, id DESC
      LIMIT 1
    ) shortest
  `);

  const longestRow = rows.find((row) => row.kind === "longest");
  const shortestRow = rows.find((row) => row.kind === "shortest");

  return {
    longest: longestRow ? gameRoundCountFromRow(longestRow) : null,
    shortest: shortestRow ? gameRoundCountFromRow(shortestRow) : null,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const id = await getUserIdFromAuth();
  const [battingAverage, scoreExtremes, cumulativeScore, gameRoundExtremes] =
    await Promise.all([
      getPlayerBattingAverageForUser(id),
      getScoreExtremesForUser(id),
      getCumulativeScoreForUser(id),
      getGameRoundExtremesForUser(id),
    ]);

  return {
    battingAverage,
    scoreExtremes,
    cumulativeScore,
    gameRoundExtremes,
  };
}

export async function getPlayerBattingAverage() {
  const id = await getUserIdFromAuth();
  return getPlayerBattingAverageForUser(id);
}

export async function getHighestAndLowestScore() {
  const id = await getUserIdFromAuth();
  return getScoreExtremesForUser(id);
}

export async function getCumulativeScore() {
  const id = await getUserIdFromAuth();
  return getCumulativeScoreForUser(id);
}

export async function getLongestAndShortestGamesByRounds() {
  const id = await getUserIdFromAuth();
  return getGameRoundExtremesForUser(id);
}

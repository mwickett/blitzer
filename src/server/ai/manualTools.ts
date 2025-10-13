import { z } from "zod";
import prisma from "@/server/db/db-readonly";
import PostHogClient from "@/app/posthog";
import { Prisma } from "@prisma/client";

async function getInternalUserId(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}

const posthog = PostHogClient();
function captureTool(
  distinctId: string,
  name: string,
  ok: boolean,
  extra?: Record<string, unknown>
) {
  try {
    posthog.capture({
      distinctId,
      event: "ai_manual_tool_call",
      properties: { tool_name: name, ok, ...(extra || {}) },
    });
  } catch {}
}

export const toolSchemas = {
  getUserOverview: z.object({}),
  getRecentGames: z.object({
    limit: z.number().int().min(1).max(50).default(10).optional(),
    finishedOnly: z.boolean().default(false).optional(),
  }),
  getExtremes: z.object({}),
  getCumulativeScore: z.object({}),
  getTrends: z.object({
    by: z.enum(["day", "week", "month"]).default("week").optional(),
    limit: z.number().int().min(1).max(365).default(26).optional(),
  }),
  getOpponentStats: z.object({
    limit: z.number().int().min(1).max(50).default(10).optional(),
    includeGuests: z.boolean().default(true).optional(),
  }),
};

export type ToolName = keyof typeof toolSchemas;

export async function runManualTool(
  clerkUserId: string,
  name: ToolName,
  rawArgs: unknown
) {
  const started = Date.now();
  try {
    const internalId = await getInternalUserId(clerkUserId);

    switch (name) {
      case "getUserOverview": {
        const games = await prisma.game.findMany({
          where: { players: { some: { userId: internalId } } },
          include: { rounds: true },
        });
        const finished = games.filter((g) => g.isFinished);
        const winCount = finished.filter((g) => g.winnerId === internalId).length;
        const scores = await prisma.score.findMany({
          where: { userId: internalId },
          include: { round: { select: { gameId: true } } },
        });
        const totalRounds = scores.length;
        let totalCardsPlayed = 0;
        let totalBlitzRemaining = 0;
        let totalBlitzes = 0;
        let highestScore = Number.NEGATIVE_INFINITY;
        let lowestScore = Number.POSITIVE_INFINITY;
        for (const s of scores) {
          totalCardsPlayed += s.totalCardsPlayed;
          totalBlitzRemaining += s.blitzPileRemaining;
          if (s.blitzPileRemaining === 0) totalBlitzes += 1;
          const calc = s.totalCardsPlayed - s.blitzPileRemaining * 2;
          if (calc > highestScore) highestScore = calc;
          if (calc < lowestScore) lowestScore = calc;
        }
        const result = {
          gamesCount: games.length,
          finishedGames: finished.length,
          winCount,
          lossCount: finished.length - winCount,
          winRate: games.length ? (winCount / games.length) * 100 : 0,
          totalRounds,
          totalBlitzes,
          totalCardsPlayed,
          avgCardsPlayed: totalRounds ? totalCardsPlayed / totalRounds : 0,
          avgBlitzRemaining: totalRounds
            ? totalBlitzRemaining / totalRounds
            : 0,
          blitzPercentage: totalRounds ? (totalBlitzes / totalRounds) * 100 : 0,
          highestScore: Number.isFinite(highestScore) ? highestScore : 0,
          lowestScore: Number.isFinite(lowestScore) ? lowestScore : 0,
        };
        captureTool(clerkUserId, name, true, {
          duration_ms: Date.now() - started,
        });
        return result;
      }

      case "getRecentGames": {
        const args = toolSchemas.getRecentGames.parse(rawArgs ?? {});
        const { limit = 10, finishedOnly = false } = args;
        const games = await prisma.game.findMany({
          where: {
            players: { some: { userId: internalId } },
            ...(finishedOnly ? { isFinished: true } : {}),
          },
          include: { rounds: true },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        const result = games.map((g) => ({
          id: g.id,
          createdAt: g.createdAt,
          isFinished: g.isFinished,
          rounds: g.rounds.length,
          userWon: g.winnerId === internalId,
        }));
        captureTool(clerkUserId, name, true, {
          duration_ms: Date.now() - started,
          rows: result.length,
        });
        return result;
      }

      case "getExtremes": {
        const rows = await prisma.$queryRaw<Array<{
          score: number;
          totalCardsPlayed: number;
          blitzPileRemaining: number;
        }>>`
          SELECT 
            ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) as score,
            "totalCardsPlayed",
            "blitzPileRemaining"
          FROM "Score"
          WHERE "userId" = ${internalId}
          AND (
            ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
              SELECT MAX("totalCardsPlayed" - ("blitzPileRemaining" * 2))
              FROM "Score" WHERE "userId" = ${internalId}
            )
            OR
            ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
              SELECT MIN("totalCardsPlayed" - ("blitzPileRemaining" * 2))
              FROM "Score" WHERE "userId" = ${internalId}
            )
          )`;
        const highest = rows.reduce((a, b) => (a.score > b.score ? a : b), rows[0]);
        const lowest = rows.reduce((a, b) => (a.score < b.score ? a : b), rows[0]);
        const result = rows.length
          ? { highest, lowest: highest === lowest ? null : lowest }
          : { highest: null, lowest: null };
        captureTool(clerkUserId, name, true, { duration_ms: Date.now() - started });
        return result;
      }

      case "getCumulativeScore": {
        const agg = await prisma.score.aggregate({
          where: { userId: internalId },
          _sum: { totalCardsPlayed: true, blitzPileRemaining: true },
        });
        const totalCardsPlayed = agg._sum.totalCardsPlayed ?? 0;
        const blitzPileRemaining = agg._sum.blitzPileRemaining ?? 0;
        const result = { totalScore: totalCardsPlayed - blitzPileRemaining * 2 };
        captureTool(clerkUserId, name, true, { duration_ms: Date.now() - started });
        return result;
      }

      case "getTrends": {
        const args = toolSchemas.getTrends.parse(rawArgs ?? {});
        const { by = "week", limit = 26 } = args;
        const dateTrunc = by === "day" ? "day" : by === "month" ? "month" : "week";
        const rows = await prisma.$queryRaw<Array<{
          period: Date;
          rounds: bigint;
          total_cards: bigint;
          total_blitz_rem: bigint;
        }>>(
          Prisma.sql`SELECT 
              date_trunc(${Prisma.raw("'" + dateTrunc + "'")}, "created_at") AS period,
              COUNT(*) as rounds,
              SUM("totalCardsPlayed") as total_cards,
              SUM("blitzPileRemaining") as total_blitz_rem
            FROM "Score"
            WHERE "userId" = ${internalId}
            GROUP BY period
            ORDER BY period DESC
            LIMIT ${limit}`
        );
        const result = rows
          .map((r) => {
            const rounds = Number(r.rounds || 0);
            const totalCards = Number(r.total_cards || 0);
            const totalBlitz = Number(r.total_blitz_rem || 0);
            return {
              periodStart: new Date(r.period).toISOString(),
              rounds,
              totalScore: totalCards - 2 * totalBlitz,
            };
          })
          .reverse();
        captureTool(clerkUserId, name, true, { duration_ms: Date.now() - started, rows: result.length });
        return result;
      }

      case "getOpponentStats": {
        const args = toolSchemas.getOpponentStats.parse(rawArgs ?? {});
        const { limit = 10, includeGuests = true } = args;
        const games = await prisma.game.findMany({
          where: { players: { some: { userId: internalId } } },
          include: { players: { include: { user: true, guestUser: true } } },
          orderBy: { createdAt: "desc" },
        });
        const map = new Map<string, {
          opponentId: string;
          opponentType: "user" | "guest";
          name: string;
          gamesTogether: number;
          finishedTogether: number;
          userWins: number;
          userLosses: number;
        }>();
        for (const g of games) {
          const userInGame = g.players.some((p) => p.userId === internalId);
          if (!userInGame) continue;
          const finished = g.isFinished;
          for (const p of g.players) {
            if (p.userId === internalId) continue;
            if (!includeGuests && p.guestId) continue;
            const key = p.userId ?? `guest:${p.guestId}`;
            const name = p.user?.username ?? p.guestUser?.name ?? "Unknown";
            const opponentType = p.userId ? "user" : "guest";
            const rec = map.get(key) || {
              opponentId: key,
              opponentType,
              name,
              gamesTogether: 0,
              finishedTogether: 0,
              userWins: 0,
              userLosses: 0,
            };
            rec.gamesTogether += 1;
            if (finished) {
              rec.finishedTogether += 1;
              if (g.winnerId === internalId) rec.userWins += 1;
              else if (g.winnerId && g.winnerId === p.userId) rec.userLosses += 1;
            }
            map.set(key, rec);
          }
        }
        const rows = Array.from(map.values())
          .sort((a, b) => b.gamesTogether - a.gamesTogether)
          .slice(0, limit)
          .map((r) => ({
            opponentId: r.opponentId,
            opponentType: r.opponentType,
            name: r.name,
            gamesTogether: r.gamesTogether,
            finishedTogether: r.finishedTogether,
            userWins: r.userWins,
            userLosses: r.userLosses,
            winRate: r.finishedTogether > 0 ? (r.userWins / r.finishedTogether) * 100 : 0,
          }));
        captureTool(clerkUserId, name, true, { duration_ms: Date.now() - started, rows: rows.length });
        return rows;
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    captureTool(clerkUserId, name, false, {
      duration_ms: Date.now() - started,
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}


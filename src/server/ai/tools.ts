import { tool, jsonSchema } from "ai";
import prisma from "@/server/db/db-readonly";
import PostHogClient from "@/app/posthog";
import { Prisma } from "@prisma/client";

// Minimal helper: resolve internal user id from Clerk user id (auth userId)
async function getInternalUserId(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true, username: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}

// Tool: basic user overview combining counts & simple rates
const getUserOverview = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Summarize the user's overall gameplay: games played, wins/losses, win rate, and aggregate stats.",
    parameters: jsonSchema({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);
      return await runWithTracing(
        posthog,
        clerkUserId,
        "getUserOverview",
        {},
        async () => {
          // Games involving user
          const games = await prisma.game.findMany({
            where: { players: { some: { userId: internalId } } },
            include: { rounds: true },
          });
          const finished = games.filter((g) => g.isFinished);
          const winCount = finished.filter((g) => g.winnerId === internalId).length;
          const lossCount = finished.length - winCount;

          // All scores for user
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

          const avgCardsPlayed = totalRounds ? totalCardsPlayed / totalRounds : 0;
          const avgBlitzRemaining = totalRounds
            ? totalBlitzRemaining / totalRounds
            : 0;
          const blitzPercentage = totalRounds
            ? (totalBlitzes / totalRounds) * 100
            : 0;

          return {
            gamesCount: games.length,
            finishedGames: finished.length,
            winCount,
            lossCount,
            winRate: games.length ? (winCount / games.length) * 100 : 0,
            totalRounds,
            totalBlitzes,
            totalCardsPlayed,
            avgCardsPlayed,
            avgBlitzRemaining,
            blitzPercentage,
            highestScore: Number.isFinite(highestScore) ? highestScore : 0,
            lowestScore: Number.isFinite(lowestScore) ? lowestScore : 0,
          };
        }
      );
    },
  });

// Tool: recent games summary
const getRecentGames = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Get a list of the user's recent games with status and round counts.",
    parameters: jsonSchema<{ limit?: number; finishedOnly?: boolean }>({
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        finishedOnly: { type: "boolean", default: false },
      },
      additionalProperties: false,
    }),
    execute: async (args: { limit?: number; finishedOnly?: boolean }) => {
      const { limit = 10, finishedOnly = false } = args || {};
      const internalId = await getInternalUserId(clerkUserId);

      const games = await runWithTracing(
        posthog,
        clerkUserId,
        "getRecentGames",
        { limit, finishedOnly },
        async () => {
          return await prisma.game.findMany({
            where: {
              players: { some: { userId: internalId } },
              ...(finishedOnly ? { isFinished: true } : {}),
            },
            include: { rounds: true },
            orderBy: { createdAt: "desc" },
            take: limit,
          });
        },
        (rows) => rows.length
      );

      return games.map((g) => ({
        id: g.id,
        createdAt: g.createdAt,
        isFinished: g.isFinished,
        rounds: g.rounds.length,
        userWon: g.winnerId === internalId,
      }));
    },
  });

// Tool: highest/lowest single-round score for the user
const getExtremes = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Get the user's highest and lowest single-round calculated scores.",
    parameters: jsonSchema({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);

      const rows = await runWithTracing(
        posthog,
        clerkUserId,
        "getExtremes",
        {},
        async () => {
          return await prisma.$queryRaw<Array<{
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
        },
        (rows) => rows.length
      );

      if (!rows.length) return { highest: null, lowest: null };
      const highest = rows.reduce((a, b) => (a.score > b.score ? a : b));
      const lowest = rows.reduce((a, b) => (a.score < b.score ? a : b));
      return { highest, lowest: highest === lowest ? null : lowest };
    },
  });

// Tool: cumulative score for the user
const getCumulativeScore = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Compute the user's cumulative score across all rounds: sum(totalCardsPlayed) - 2*sum(blitzPileRemaining).",
    parameters: jsonSchema({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);

      return await runWithTracing(
        posthog,
        clerkUserId,
        "getCumulativeScore",
        {},
        async () => {
          const agg = await prisma.score.aggregate({
            where: { userId: internalId },
            _sum: { totalCardsPlayed: true, blitzPileRemaining: true },
          });
          const totalCardsPlayed = agg._sum.totalCardsPlayed ?? 0;
          const blitzPileRemaining = agg._sum.blitzPileRemaining ?? 0;
          return { totalScore: totalCardsPlayed - blitzPileRemaining * 2 };
        }
      );
    },
  });

// Small helper to capture tool telemetry
function captureTool(
  posthog: ReturnType<typeof PostHogClient>,
  distinctId: string,
  event: string,
  properties: Record<string, unknown>
) {
  try {
    posthog.capture({ distinctId, event, properties });
  } catch (_) {
    // ignore telemetry errors
  }
}

// Wrap a tool execute function with tracing
async function runWithTracing<T>(
  posthog: ReturnType<typeof PostHogClient>,
  distinctId: string,
  toolName: string,
  params: unknown,
  fn: () => Promise<T>,
  countRows?: (result: T) => number
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const rows = countRows ? countRows(result) : undefined;
    captureTool(posthog, distinctId, "ai_tool_call", {
      tool_name: toolName,
      ok: true,
      duration_ms: Date.now() - start,
      rows_returned: rows,
      params: params ? JSON.stringify(params).slice(0, 2000) : undefined,
    });
    return result;
  } catch (error) {
    captureTool(posthog, distinctId, "ai_tool_call", {
      tool_name: toolName,
      ok: false,
      duration_ms: Date.now() - start,
      error_message: error instanceof Error ? error.message : String(error),
      params: params ? JSON.stringify(params).slice(0, 2000) : undefined,
    });
    throw error;
  }
}

// Trends tool: aggregate by day/week/month
const getTrends = (clerkUserId: string, posthog: ReturnType<typeof PostHogClient>) =>
  tool({
    description:
      "Time series of user's performance aggregated by day, week, or month.",
    parameters: jsonSchema<{ by?: "day" | "week" | "month"; limit?: number }>({
      type: "object",
      properties: {
        by: { type: "string", enum: ["day", "week", "month"], default: "week" },
        limit: { type: "integer", minimum: 1, maximum: 365, default: 26 },
      },
      additionalProperties: false,
    }),
    execute: async (args: { by?: "day" | "week" | "month"; limit?: number }) => {
      const { by = "week", limit = 26 } = args || {};
      const internalId = await getInternalUserId(clerkUserId);

      const dateTrunc = by === "day" ? "day" : by === "month" ? "month" : "week";

      const rows = await runWithTracing(
        posthog,
        clerkUserId,
        "getTrends",
        { by, limit },
        async () => {
          return await prisma.$queryRaw<Array<{
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
        },
        (result) => result.length
      );

      // Normalize bigints and compute totalScore
      return rows
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
    },
  });

// Opponent stats tool
const getOpponentStats = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Win/loss record versus opponents the user has played with, including guests.",
    parameters: jsonSchema<{ limit?: number; includeGuests?: boolean }>({
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        includeGuests: { type: "boolean", default: true },
      },
      additionalProperties: false,
    }),
    execute: async (args: { limit?: number; includeGuests?: boolean }) => {
      const { limit = 10, includeGuests = true } = args || {};
      const internalId = await getInternalUserId(clerkUserId);

      const result = await runWithTracing(
        posthog,
        clerkUserId,
        "getOpponentStats",
        { limit, includeGuests },
        async () => {
          const games = await prisma.game.findMany({
            where: { players: { some: { userId: internalId } } },
            include: {
              players: { include: { user: true, guestUser: true } },
            },
            orderBy: { createdAt: "desc" },
          });

          type OpponentRow = {
            opponentId: string;
            opponentType: "user" | "guest";
            name: string;
            gamesTogether: number;
            finishedTogether: number;
            userWins: number;
            userLosses: number;
          };

          const map = new Map<string, OpponentRow>();

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
              const rec: OpponentRow =
                map.get(key) ?? {
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
              winRate:
                r.finishedTogether > 0
                  ? (r.userWins / r.finishedTogether) * 100
                  : 0,
            }));

          return rows;
        },
        (rows) => rows.length
      );

      return result;
    },
  });

export function createAnalyticsTools(clerkUserId: string) {
  const posthog = PostHogClient();
  return {
    getUserOverview: getUserOverview(clerkUserId, posthog),
    getRecentGames: getRecentGames(clerkUserId, posthog),
    getExtremes: getExtremes(clerkUserId, posthog),
    getCumulativeScore: getCumulativeScore(clerkUserId, posthog),
    getTrends: getTrends(clerkUserId, posthog),
    getOpponentStats: getOpponentStats(clerkUserId, posthog),
  } as const;
}

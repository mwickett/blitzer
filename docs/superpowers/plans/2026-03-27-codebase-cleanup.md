# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the Blitzer codebase — remove dead code, consolidate duplicated AI tools, split monolithic files by domain, improve type safety, and create issues for deferred work.

**Architecture:** Six independent cleanup tasks executed sequentially. Each produces a self-contained commit. No task depends on another's code changes (they touch different files), but they should be done in order to keep the PR reviewable.

**Tech Stack:** Next.js 16, React 19, Prisma 7, TypeScript 6, Zod, AI SDK 6

---

### Task 1: Dead Code Removal

**Files:**
- Delete: `src/server/test-gameplayers.js`
- Delete: `src/components/FeatureFlagExample.tsx`
- Modify: `src/featureFlags.ts`
- Modify: `src/hooks/useFeatureFlag.ts`

- [ ] **Step 1: Delete dead files**

```bash
rm src/server/test-gameplayers.js src/components/FeatureFlagExample.tsx
```

- [ ] **Step 2: Remove `isScoreChartsEnabled` from `src/featureFlags.ts`**

The file should become:

```typescript
import PostHogClient from "./app/posthog";
import { auth } from "@clerk/nextjs/server";

// Server-side flag checking
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  const { userId } = await auth();

  // Only check flags for authenticated users
  if (!userId) return false;

  const posthog = PostHogClient();
  const flags = await posthog.getAllFlags(userId);

  return !!flags[flagKey];
}

// Check if LLM features are enabled
export async function isLlmFeaturesEnabled(): Promise<boolean> {
  return isFeatureEnabled("llm-features");
}
```

- [ ] **Step 3: Remove `useScoreChartsFlag` from `src/hooks/useFeatureFlag.ts`**

The file should become:

```typescript
"use client";

import { usePostHog } from "posthog-js/react";
import { useAuth } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export function useFeatureFlag(flagKey: string): boolean {
  const posthog = usePostHog();
  const { isSignedIn } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Only check flags for authenticated users
    if (!isSignedIn || !posthog) return;

    // Get the feature flag value
    const flagValue = posthog.isFeatureEnabled(flagKey);

    if (typeof flagValue === "boolean") {
      setEnabled(flagValue);
    }
  }, [posthog, flagKey, isSignedIn]);

  return enabled;
}

// Convenience hook for the llm-features flag
export function useLlmFeaturesFlag(): boolean {
  return useFeatureFlag("llm-features");
}
```

- [ ] **Step 4: Run tests to verify nothing breaks**

Run: `npm test`
Expected: All 53 tests pass (none of the deleted code was tested or imported)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove dead code (test-gameplayers.js, FeatureFlagExample, stale flag helpers)"
```

---

### Task 2: AI Tools Consolidation

**Files:**
- Modify: `src/server/ai/tools.ts`
- Delete: `src/server/ai/manualTools.ts`
- Modify: `package.json` (remove `@opentelemetry/exporter-trace-otlp-http`)

- [ ] **Step 1: Rewrite `src/server/ai/tools.ts` with Zod schemas**

Replace the entire file. Key changes from current: `jsonSchema()` → Zod schemas via `zodSchema()`, keep `runWithTracing()` and `captureTool()`, keep `createAnalyticsTools()` export signature identical.

```typescript
import { tool } from "ai";
import { zodSchema } from "ai";
import { z } from "zod";
import prisma from "@/server/db/db-readonly";
import PostHogClient from "@/app/posthog";
import { Prisma } from "@/generated/prisma/client";

// --- Constants ---

const MAX_RECENT_GAMES = 50;
const MAX_TREND_PERIODS = 365;
const MAX_OPPONENTS = 50;
const DEFAULT_RECENT_GAMES_LIMIT = 10;
const DEFAULT_TREND_LIMIT = 26;
const DEFAULT_OPPONENTS_LIMIT = 10;

// --- Helpers ---

async function getInternalUserId(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}

function captureTool(
  posthog: ReturnType<typeof PostHogClient>,
  distinctId: string,
  event: string,
  properties: Record<string, unknown>
) {
  try {
    posthog.capture({ distinctId, event, properties });
  } catch {
    // ignore telemetry errors
  }
}

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

// --- Tool Definitions ---

const getUserOverview = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Summarize the user's overall gameplay: games played, wins/losses, win rate, and aggregate stats.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);
      return await runWithTracing(
        posthog, clerkUserId, "getUserOverview", {},
        async () => {
          const games = await prisma.game.findMany({
            where: { players: { some: { userId: internalId } } },
            include: { rounds: true },
          });
          const finished = games.filter((g) => g.isFinished);
          const winCount = finished.filter((g) => g.winnerId === internalId).length;
          const lossCount = finished.length - winCount;

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

          return {
            gamesCount: games.length,
            finishedGames: finished.length,
            winCount,
            lossCount,
            winRate: games.length ? (winCount / games.length) * 100 : 0,
            totalRounds,
            totalBlitzes,
            totalCardsPlayed,
            avgCardsPlayed: totalRounds ? totalCardsPlayed / totalRounds : 0,
            avgBlitzRemaining: totalRounds ? totalBlitzRemaining / totalRounds : 0,
            blitzPercentage: totalRounds ? (totalBlitzes / totalRounds) * 100 : 0,
            highestScore: Number.isFinite(highestScore) ? highestScore : 0,
            lowestScore: Number.isFinite(lowestScore) ? lowestScore : 0,
          };
        }
      );
    },
  });

const getRecentGames = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Get a list of the user's recent games with status and round counts.",
    inputSchema: zodSchema(
      z.object({
        limit: z.number().int().min(1).max(MAX_RECENT_GAMES).default(DEFAULT_RECENT_GAMES_LIMIT).optional(),
        finishedOnly: z.boolean().default(false).optional(),
      })
    ),
    execute: async (args) => {
      const { limit = DEFAULT_RECENT_GAMES_LIMIT, finishedOnly = false } = args;
      const internalId = await getInternalUserId(clerkUserId);

      const games = await runWithTracing(
        posthog, clerkUserId, "getRecentGames", { limit, finishedOnly },
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

const getExtremes = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Get the user's highest and lowest single-round calculated scores.",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);

      const rows = await runWithTracing(
        posthog, clerkUserId, "getExtremes", {},
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

const getCumulativeScore = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Compute the user's cumulative score across all rounds: sum(totalCardsPlayed) - 2*sum(blitzPileRemaining).",
    inputSchema: zodSchema(z.object({})),
    execute: async () => {
      const internalId = await getInternalUserId(clerkUserId);

      return await runWithTracing(
        posthog, clerkUserId, "getCumulativeScore", {},
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

const getTrends = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Time series of user's performance aggregated by day, week, or month.",
    inputSchema: zodSchema(
      z.object({
        by: z.enum(["day", "week", "month"]).default("week").optional(),
        limit: z.number().int().min(1).max(MAX_TREND_PERIODS).default(DEFAULT_TREND_LIMIT).optional(),
      })
    ),
    execute: async (args) => {
      const { by = "week", limit = DEFAULT_TREND_LIMIT } = args;
      const internalId = await getInternalUserId(clerkUserId);

      const dateTrunc = by === "day" ? "day" : by === "month" ? "month" : "week";

      const rows = await runWithTracing(
        posthog, clerkUserId, "getTrends", { by, limit },
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

      return rows
        .map((r) => ({
          periodStart: new Date(r.period).toISOString(),
          rounds: Number(r.rounds || 0),
          totalScore: Number(r.total_cards || 0) - 2 * Number(r.total_blitz_rem || 0),
        }))
        .reverse();
    },
  });

const getOpponentStats = (
  clerkUserId: string,
  posthog: ReturnType<typeof PostHogClient>
) =>
  tool({
    description:
      "Win/loss record versus opponents the user has played with, including guests.",
    inputSchema: zodSchema(
      z.object({
        limit: z.number().int().min(1).max(MAX_OPPONENTS).default(DEFAULT_OPPONENTS_LIMIT).optional(),
        includeGuests: z.boolean().default(true).optional(),
      })
    ),
    execute: async (args) => {
      const { limit = DEFAULT_OPPONENTS_LIMIT, includeGuests = true } = args;
      const internalId = await getInternalUserId(clerkUserId);

      const result = await runWithTracing(
        posthog, clerkUserId, "getOpponentStats", { limit, includeGuests },
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

            for (const p of g.players) {
              if (p.userId === internalId) continue;
              if (!includeGuests && p.guestId) continue;

              const key = p.userId ?? `guest:${p.guestId}`;
              const name = p.user?.username ?? p.guestUser?.name ?? "Unknown";
              const opponentType = p.userId ? "user" : "guest";
              const rec: OpponentRow = map.get(key) ?? {
                opponentId: key, opponentType, name,
                gamesTogether: 0, finishedTogether: 0, userWins: 0, userLosses: 0,
              };
              rec.gamesTogether += 1;
              if (g.isFinished) {
                rec.finishedTogether += 1;
                if (g.winnerId === internalId) rec.userWins += 1;
                else if (g.winnerId && g.winnerId === p.userId) rec.userLosses += 1;
              }
              map.set(key, rec);
            }
          }

          return Array.from(map.values())
            .sort((a, b) => b.gamesTogether - a.gamesTogether)
            .slice(0, limit)
            .map((r) => ({
              ...r,
              winRate: r.finishedTogether > 0 ? (r.userWins / r.finishedTogether) * 100 : 0,
            }));
        },
        (rows) => rows.length
      );

      return result;
    },
  });

// --- Public API ---

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
```

- [ ] **Step 2: Delete manualTools.ts**

```bash
rm src/server/ai/manualTools.ts
```

- [ ] **Step 3: Remove `@opentelemetry/exporter-trace-otlp-http` dependency**

```bash
npm uninstall @opentelemetry/exporter-trace-otlp-http
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 53 tests pass

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: consolidate AI tools — Zod schemas, delete manualTools.ts"
```

---

### Task 3: Split queries.ts by Domain

**Files:**
- Create: `src/server/queries/games.ts`
- Create: `src/server/queries/friends.ts`
- Create: `src/server/queries/users.ts`
- Create: `src/server/queries/stats.ts`
- Create: `src/server/queries/index.ts`
- Modify: `src/server/queries.ts` (becomes barrel re-export)

- [ ] **Step 1: Create `src/server/queries/` directory**

```bash
mkdir -p src/server/queries
```

- [ ] **Step 2: Create `src/server/queries/games.ts`**

```typescript
import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

// Fetch all games that the current user is a part of
export async function getGames() {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const games = await prisma.game.findMany({
    where: {
      players: {
        some: {
          user: {
            clerk_user_id: user.userId,
          },
        },
      },
    },
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
      rounds: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  posthog.capture({ distinctId: user.userId, event: "get_games" });

  return games;
}

// Fetch a single game by ID
export async function getGameById(id: string) {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
      rounds: {
        include: {
          scores: {
            include: {
              user: true,
              guestUser: true,
            },
          },
        },
      },
    },
  });

  return game;
}
```

- [ ] **Step 3: Create `src/server/queries/friends.ts`**

```typescript
import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import { getUserIdFromAuth } from "@/server/utils";

// Get all friends of the current user
export async function getFriends() {
  const id = await getUserIdFromAuth();

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: id }, { user2Id: id }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  return friends.map((friend) => {
    return friend.user1Id === id ? friend.user2 : friend.user1;
  });
}

// Get all friends of the current user and include the current user
// Used when creating a new game
export async function getFriendsForNewGame() {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
  });

  if (!prismaUser) throw new Error("User not found");

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: prismaUser.id }, { user2Id: prismaUser.id }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const result = friends.map((friend) => {
    return friend.user1Id === prismaUser.id ? friend.user2 : friend.user1;
  });

  return [prismaUser, ...result];
}

// Get all pending incoming friend requests
export async function getIncomingFriendRequests() {
  const id = await getUserIdFromAuth();

  return await prisma.friendRequest.findMany({
    where: {
      receiverId: id,
      status: "PENDING",
    },
    include: {
      sender: true,
    },
  });
}

// Get all friend requests that the current user has sent that are pending
export async function getOutgoingPendingFriendRequests() {
  const id = await getUserIdFromAuth();

  return await prisma.friendRequest.findMany({
    where: {
      senderId: id,
      status: "PENDING",
    },
    include: {
      receiver: true,
    },
  });
}
```

- [ ] **Step 4: Create `src/server/queries/users.ts`**

```typescript
import "server-only";

import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";

// Fetches users who are not the current user, not already friends,
// and don't have pending friend requests with the current user
export async function getFilteredUsers() {
  const id = await getUserIdFromAuth();

  return await prisma.user.findMany({
    where: {
      NOT: {
        OR: [
          { id },
          { friends1: { some: { user2Id: id } } },
          { friends2: { some: { user1Id: id } } },
          { friendRequestsSent: { some: { receiverId: id } } },
          { friendRequestsReceived: { some: { senderId: id, status: "PENDING" } } },
        ],
      },
    },
  });
}
```

- [ ] **Step 5: Create `src/server/queries/stats.ts`**

This includes the fix for `getHighestAndLowestScore()` — the `scores[0]` access in the reduce calls now has an early return guard when no scores exist.

```typescript
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";

// Batting average: ratio of rounds where user blitzed (0 remaining) to total rounds
export async function getPlayerBattingAverage() {
  const id = await getUserIdFromAuth();

  const totalHandsPlayed = await prisma.score.count({
    where: { userId: id },
  });

  const totalHandsWon = await prisma.score.count({
    where: { userId: id, blitzPileRemaining: 0 },
  });

  const rawBattingAverage =
    totalHandsPlayed === 0 ? 0 : totalHandsWon / totalHandsPlayed;

  return {
    totalHandsPlayed,
    totalHandsWon,
    battingAverage: rawBattingAverage.toFixed(3),
  };
}

// Highest and lowest single-round calculated scores
// Score formula: totalCardsPlayed - (blitzPileRemaining * 2)
export async function getHighestAndLowestScore() {
  const id = await getUserIdFromAuth();

  const scores = await prisma.$queryRaw<
    Array<{
      score: number;
      totalCardsPlayed: number;
      blitzPileRemaining: number;
    }>
  >(
    Prisma.sql`
      SELECT
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) as score,
        "totalCardsPlayed",
        "blitzPileRemaining"
      FROM "Score"
      WHERE "userId" = ${id}
      AND (
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
          SELECT MAX("totalCardsPlayed" - ("blitzPileRemaining" * 2))
          FROM "Score"
          WHERE "userId" = ${id}
        )
        OR
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
          SELECT MIN("totalCardsPlayed" - ("blitzPileRemaining" * 2))
          FROM "Score"
          WHERE "userId" = ${id}
        )
      )
    `
  );

  if (!scores.length) {
    return { highest: null, lowest: null };
  }

  const createScoreObject = (score: (typeof scores)[0]) => ({
    score: score.score,
    totalCardsPlayed: score.totalCardsPlayed,
    blitzPileRemaining: score.blitzPileRemaining,
  });

  const highestScore = scores.reduce(
    (max, score) => (max.score > score.score ? max : score),
    scores[0]
  );
  const lowestScore = scores.reduce(
    (min, score) => (min.score < score.score ? min : score),
    scores[0]
  );

  const highest = createScoreObject(highestScore);

  if (lowestScore === highestScore) {
    return { highest, lowest: null };
  }

  return { highest, lowest: createScoreObject(lowestScore) };
}

// Cumulative score across all rounds
export async function getCumulativeScore() {
  const id = await getUserIdFromAuth();

  const cumulativeScore = await prisma.score.aggregate({
    where: { userId: id },
    _sum: { totalCardsPlayed: true, blitzPileRemaining: true },
  });

  const totalCardsPlayed = cumulativeScore._sum.totalCardsPlayed;
  const blitzPileRemaining = cumulativeScore._sum.blitzPileRemaining;

  if (totalCardsPlayed === null || blitzPileRemaining === null) {
    return 0;
  }

  return totalCardsPlayed - blitzPileRemaining * 2;
}

// Longest and shortest completed games by round count
export async function getLongestAndShortestGamesByRounds() {
  const id = await getUserIdFromAuth();

  const games = await prisma.game.findMany({
    where: {
      players: { some: { userId: id } },
      isFinished: true,
    },
    include: { rounds: true },
  });

  if (!games.length) {
    return { longest: null, shortest: null };
  }

  const gamesWithRoundCount = games.map((game) => ({
    id: game.id,
    roundCount: game.rounds.length,
    isFinished: game.isFinished,
  }));

  const longestGame = gamesWithRoundCount.reduce(
    (longest, current) =>
      current.roundCount > longest.roundCount ? current : longest,
    gamesWithRoundCount[0]
  );

  const gamesWithRounds = gamesWithRoundCount.filter((game) => game.roundCount > 0);

  if (!gamesWithRounds.length) {
    return { longest: longestGame, shortest: null };
  }

  const shortestGame = gamesWithRounds.reduce(
    (shortest, current) =>
      current.roundCount < shortest.roundCount ? current : shortest,
    gamesWithRounds[0]
  );

  return { longest: longestGame, shortest: shortestGame };
}
```

- [ ] **Step 6: Create `src/server/queries/index.ts`**

```typescript
export { getGames, getGameById } from "./games";
export { getFriends, getFriendsForNewGame, getIncomingFriendRequests, getOutgoingPendingFriendRequests } from "./friends";
export { getFilteredUsers } from "./users";
export { getPlayerBattingAverage, getHighestAndLowestScore, getCumulativeScore, getLongestAndShortestGamesByRounds } from "./stats";
```

- [ ] **Step 7: Replace `src/server/queries.ts` with barrel re-export**

```typescript
// Backward-compatible re-export. New code should import from @/server/queries/<domain>.
export {
  getGames,
  getGameById,
  getFriends,
  getFriendsForNewGame,
  getIncomingFriendRequests,
  getOutgoingPendingFriendRequests,
  getFilteredUsers,
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "./queries/index";
```

- [ ] **Step 8: Build and test**

Run: `npm run build && npm test`
Expected: Build succeeds, all 53 tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "refactor: split queries.ts into domain modules (games, friends, users, stats)"
```

---

### Task 4: Split scoreDisplay.tsx

**Files:**
- Create: `src/app/games/[id]/scoreTypes.ts`
- Create: `src/app/games/[id]/ScoreEditor.tsx`
- Modify: `src/app/games/[id]/scoreDisplay.tsx` (strip edit logic, keep display)

- [ ] **Step 1: Create `src/app/games/[id]/scoreTypes.ts`**

```typescript
import { z } from "zod";

export const playerScoreSchema = z.object({
  id: z.string(),
  username: z.string(),
  isGuest: z.boolean().optional(),
  roundNumber: z.number().min(1),
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

export const scoresSchema = z.array(playerScoreSchema);

export type EditingScore = z.infer<typeof playerScoreSchema>;
```

- [ ] **Step 2: Create `src/app/games/[id]/ScoreEditor.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { updateRoundScores } from "@/server/mutations";
import { DisplayScores } from "@/lib/gameLogic";
import { scoresSchema, type EditingScore } from "./scoreTypes";

export function ScoreEditor({
  gameId,
  roundIndex,
  displayScores,
  onCancel,
}: {
  gameId: string;
  roundIndex: number;
  displayScores: DisplayScores[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [editingScores, setEditingScores] = useState<EditingScore[]>([]);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [scoresValid, setScoresValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const validateScores = (scores: EditingScore[]) => {
    try {
      scoresSchema.parse(scores);
      validateGameRules(scores);
      setScoresValid(true);
      setError(null);
    } catch (e) {
      setScoresValid(false);
      if (e instanceof ValidationError) {
        setError(e.message);
      } else {
        setError("Please fill in all fields correctly");
      }
    }
  };

  // Load round data on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/rounds/${gameId}/${roundIndex + 1}`);
        if (!response.ok) throw new Error("Failed to fetch round scores");
        const roundData = await response.json();

        if (!roundData?.id || !Array.isArray(roundData.scores)) {
          throw new Error("Invalid round data returned from server");
        }

        setEditingRoundId(roundData.id);

        const validScores = roundData.scores.filter(
          (score: Record<string, unknown>) => score && (score.userId || score.guestId)
        );

        const roundScores: EditingScore[] = validScores
          .map((score: Record<string, unknown>) => {
            const playerId = (score.userId || score.guestId) as string;
            if (!playerId) return null;

            const player = displayScores.find((p) => p.id === playerId);

            return {
              id: playerId,
              username: player?.username || "Unknown Player",
              isGuest: !!score.guestId,
              roundNumber: roundIndex + 1,
              blitzPileRemaining: (score.blitzPileRemaining as number) || 0,
              totalCardsPlayed: (score.totalCardsPlayed as number) || 0,
              touched: { totalCardsPlayed: true },
            };
          })
          .filter(Boolean) as EditingScore[];

        setEditingScores(roundScores);
        validateScores(roundScores);
      } catch {
        setError("Failed to load round scores. Please try again.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!scoresValid || !editingRoundId) return;

    setError(null);
    setIsSaving(true);
    try {
      const scoresToSave = editingScores.map((score) => {
        const result: {
          userId?: string;
          guestId?: string;
          blitzPileRemaining: number;
          totalCardsPlayed: number;
        } = {
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
        };

        if (score.isGuest) {
          result.guestId = score.id;
        } else {
          result.userId = score.id;
        }

        return result;
      });

      await updateRoundScores(gameId, editingRoundId, scoresToSave);
      onCancel();
      router.refresh();
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(err.message);
      } else {
        setError("Failed to save scores. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleScoreChange = (
    playerId: string,
    field: "blitzPileRemaining" | "totalCardsPlayed",
    value: string
  ) => {
    setError(null);

    if (value === "") {
      setEditingScores((prev) =>
        prev.map((score) =>
          score.id === playerId
            ? {
                ...score,
                [field]: 0,
                touched: {
                  ...score.touched,
                  totalCardsPlayed:
                    field === "totalCardsPlayed" ? true : score.touched.totalCardsPlayed,
                },
              }
            : score
        )
      );
      return;
    }

    const intValue = parseInt(value, 10);
    if (isNaN(intValue)) return;

    const maxValue = field === "blitzPileRemaining" ? 10 : 40;
    if (intValue < 0 || intValue > maxValue) return;

    const updatedScores = editingScores.map((score) =>
      score.id === playerId
        ? {
            ...score,
            [field]: intValue,
            touched: {
              ...score.touched,
              totalCardsPlayed:
                field === "totalCardsPlayed" ? true : score.touched.totalCardsPlayed,
            },
          }
        : score
    );
    setEditingScores(updatedScores);
    validateScores(updatedScores);
  };

  if (isLoading) {
    return (
      <>
        {displayScores.map((player) => (
          <TableCell key={player.id}>Loading...</TableCell>
        ))}
        <TableCell />
      </>
    );
  }

  return (
    <>
      {error && (
        <TableCell colSpan={displayScores.length + 2}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </TableCell>
      )}
      {!error &&
        displayScores.map((player) => {
          const editingScore = editingScores.find((score) => score.id === player.id);
          return (
            <TableCell key={player.id} className="space-y-2">
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editingScore?.blitzPileRemaining ?? ""}
                onChange={(e) =>
                  handleScoreChange(player.id, "blitzPileRemaining", e.target.value)
                }
                min={0}
                max={10}
                className="w-full"
                placeholder="Blitz"
              />
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editingScore?.totalCardsPlayed ?? ""}
                onChange={(e) =>
                  handleScoreChange(player.id, "totalCardsPlayed", e.target.value)
                }
                min={0}
                max={40}
                className="w-full"
                placeholder="Total"
              />
            </TableCell>
          );
        })}
      {!error && (
        <TableCell>
          <div className="space-x-2">
            <Button onClick={handleSave} disabled={!scoresValid || isSaving} size="sm" variant="outline">
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button onClick={onCancel} size="sm" variant="outline">
              Cancel
            </Button>
          </div>
        </TableCell>
      )}
    </>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/games/[id]/scoreDisplay.tsx`**

Strip all edit state and logic. The component now only handles display and delegates editing to ScoreEditor.

```typescript
"use client";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScoreLineGraph } from "@/components/ScoreLineGraph";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DisplayScores } from "@/lib/gameLogic";
import { useState } from "react";
import { ScoreEditor } from "./ScoreEditor";

function ScoreDisplay({
  displayScores,
  numRounds,
  gameId,
  isFinished,
}: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
}) {
  const [editingRound, setEditingRound] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <Table className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-4 sm:p-6 max-w-md mx-auto mb-4">
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Round</TableHead>
            {displayScores.map((player) => (
              <TableHead
                key={player.id}
                className={`text-xs ${player.isWinner ? "bg-green-50" : ""}`}
              >
                {player.isWinner ? `⭐ ${player.username} ⭐` : player.username}
                {player.isGuest ? " (Guest)" : ""}
              </TableHead>
            ))}
            {!isFinished && <TableHead className="w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: numRounds }).map((_, roundIndex) => (
            <TableRow key={roundIndex}>
              <TableCell className="font-medium bg-slate-50">
                {roundIndex + 1}
              </TableCell>
              {editingRound === roundIndex ? (
                <ScoreEditor
                  gameId={gameId}
                  roundIndex={roundIndex}
                  displayScores={displayScores}
                  onCancel={() => setEditingRound(null)}
                />
              ) : (
                <>
                  {displayScores.map((player) => {
                    const score = player.scoresByRound[roundIndex];
                    return (
                      <TableCell key={player.id}>{score ?? "-"}</TableCell>
                    );
                  })}
                  {!isFinished && (
                    <TableCell>
                      <Button
                        onClick={() => setEditingRound(roundIndex)}
                        size="sm"
                        variant="outline"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            {displayScores.map((player) => (
              <TableCell
                className={player.isInLead ? "bg-green-100" : ""}
                key={player.id}
              >
                {player.total}
              </TableCell>
            ))}
            {!isFinished && <TableCell />}
          </TableRow>
        </TableFooter>
      </Table>
      <div className="max-w-5xl mx-auto mb-4">
        <ScoreLineGraph displayScores={displayScores} />
      </div>
    </div>
  );
}

export default function ScoreDisplayWithErrorBoundary(props: {
  displayScores: DisplayScores[];
  numRounds: number;
  gameId: string;
  isFinished: boolean;
}) {
  return (
    <ErrorBoundary
      componentName="ScoreDisplay"
      context={{
        gameId: props.gameId,
        rounds: props.numRounds,
        players: props.displayScores.length,
        section: "game-detail",
      }}
    >
      <ScoreDisplay {...props} />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 4: Build and test**

Run: `npm run build && npm test`
Expected: Build succeeds, all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor: split scoreDisplay into ScoreDisplay (read-only) + ScoreEditor (edit mode)"
```

---

### Task 5: Type Safety & Code Hygiene

**Files:**
- Modify: `src/server/email.ts`
- Modify: `src/app/api/slack/whois/route.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Fix `any` type in `src/server/email.ts`**

Read the file first to see the full context around line 14, then change:

```typescript
// Before
react: any;

// After
react: React.ReactElement;
```

Add the import at the top of the file:

```typescript
import React from "react";
```

Also extract magic numbers in the same file:

```typescript
// Before (lines ~24-26)
const maxAttempts = 3;
const baseDelay = 1000;

// After — move to top of file as module constants
const EMAIL_MAX_RETRY_ATTEMPTS = 3;
const EMAIL_RETRY_BASE_DELAY_MS = 1000;
const EMAIL_INTER_SEND_DELAY_MS = 600;
```

Update all references to use the new constant names.

- [ ] **Step 2: Fix `any` type in `src/app/api/slack/whois/route.ts`**

Read the file to see what `stats` actually contains (it's the return value of the `getUserStats` function above it), then replace:

```typescript
// Before
function formatSlackResponse(stats: any) {

// After
interface SlackUserStats {
  user: { createdAt: Date; username: string };
  friendCount: number;
  totalGames: number;
  recentGames: number;
  totalRounds: number;
  roundsWon: number;
  battingAverage: string;
  cumulativeScore: number;
  lastActivity: Date | undefined;
}

function formatSlackResponse(stats: SlackUserStats) {
```

- [ ] **Step 3: Fix placeholder API key check in `src/app/api/chat/route.ts`**

```typescript
// Before (lines 38-40)
const hasApiKey =
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== "sk-your-openai-api-key";

// After
const hasApiKey = !!process.env.OPENAI_API_KEY;
```

- [ ] **Step 4: Verify no stray console.logs in non-error paths**

```bash
grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "console.error" | grep -v "console.warn" | grep -v ".test."
```

Any results in production code should be removed (the scoreDisplay console.logs were already removed in Task 4).

- [ ] **Step 5: Build and test**

Run: `npm run build && npm test`
Expected: Build succeeds, all tests pass

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: fix any types, extract magic numbers, clean up API key check"
```

---

### Task 6: Create GitHub Issues for Deferred Work

**Files:** None (GitHub API only)

- [ ] **Step 1: Create Tailwind CSS 4 migration issue**

```bash
gh issue create --title "Migrate Tailwind CSS 3 to 4" --body "Tailwind CSS 4 is a full rearchitecture — new config format (CSS-based instead of JS), new utility patterns. This is a separate effort from the general cleanup.

## Scope
- Migrate tailwind.config.ts to CSS-based config
- Update tailwind-merge to v3+
- Audit all utility classes for compatibility
- Test responsive breakpoints"
```

- [ ] **Step 2: Create component tests issue**

```bash
gh issue create --title "Add component tests with React Testing Library" --body "The codebase has good unit test coverage for business logic but zero component tests.

## Priority components
- scoreEntry.tsx — form validation, score submission
- ScoreDisplay/ScoreEditor — display and edit modes
- newGameChooser.tsx — player selection, guest management
- GamesList.tsx — filtering, sorting"
```

- [ ] **Step 3: Create newGameChooser refactor issue**

```bash
gh issue create --title "Refactor newGameChooser.tsx state management" --body "The component manages complex state (selected players, guest players with temporary UUIDs, tabs) with multiple useState calls. Would benefit from useReducer or a state machine.

## Current pain points
- Temporary UUID generation for guests
- Multiple interdependent state variables
- Complex conditional logic for player types"
```

- [ ] **Step 4: Create feature flag caching issue**

```bash
gh issue create --title "Add feature flag caching strategy" --body "Currently every feature flag check calls PostHog with no caching. This adds latency to every flagged feature.

## Scope
- Server-side: cache flags per-request or per-session
- Client-side: cache flag values between hook instances
- Consider PostHog's built-in caching options"
```

- [ ] **Step 5: Create auth middleware issue**

```bash
gh issue create --title "Consolidate route-level auth to middleware" --body "Authentication is currently checked per-route/per-query. Could be consolidated into Next.js middleware for consistent protection.

## Current pattern
- Each query calls \`auth()\` or \`getUserIdFromAuth()\` independently
- Some routes check auth, others assume it
- Middleware could provide a centralized auth gate"
```

- [ ] **Step 6: Create AI tool tests issue**

```bash
gh issue create --title "Add test coverage for AI analytics tools" --body "The 6 AI analytics tools in tools.ts have zero test coverage despite containing complex SQL queries and business logic.

## Tools needing tests
- getUserOverview — aggregate stats calculation
- getRecentGames — filtering and pagination
- getExtremes — raw SQL with MAX/MIN
- getCumulativeScore — aggregate calculation
- getTrends — date_trunc SQL, bigint handling
- getOpponentStats — in-memory aggregation logic"
```

- [ ] **Step 7: Commit** (nothing to commit — issues are on GitHub)

Verify all 6 issues were created:

```bash
gh issue list --limit 10
```

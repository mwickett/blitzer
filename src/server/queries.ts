import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import { getUserIdFromAuth } from "@/server/utils";

// Get the active org ID, throw if missing
async function requireActiveOrgId() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No active organization selected");
  return orgId;
}

// Return members of the active organization (for New Game)
export async function getOrgMembers() {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) throw new Error("No active organization selected");

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          clerk_user_id: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Filter out any null users (shouldn't happen) and map to UserSubset-like objects
  return memberships
    .map((m) => m.user)
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
}

// Deprecated: friends-based user list
export async function getFilteredUsers() {
  console.warn("getFilteredUsers is deprecated. Use getOrgMembers instead.");
  return [];
}

// Fetch all games for current user within active org
export async function getGames() {
  const user = await auth();
  const orgId = await requireActiveOrgId();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const games = await prisma.game.findMany({
    where: {
      organizationId: orgId,
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

  posthog.capture({
    distinctId: user.userId,
    event: "get_games",
    properties: { organizationId: orgId },
    groups: { organization: orgId },
  });

  return games;
}

// Fetch a single game by ID within active org
export async function getGameById(id: string) {
  const user = await auth();
  const orgId = await requireActiveOrgId();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.findFirst({
    where: {
      id: id,
      organizationId: orgId,
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

// Deprecated friends functions
export async function getFriends() {
  console.warn(
    "getFriends is deprecated under org model. Returning empty list."
  );
  return [];
}
export async function getFriendsForNewGame() {
  console.warn("getFriendsForNewGame is deprecated under org model.");
  throw new Error("Deprecated");
}
export async function getIncomingFriendRequests() {
  console.warn(
    "getIncomingFriendRequests is deprecated under org model. Returning empty list."
  );
  return [];
}
export async function getOutgoingPendingFriendRequests() {
  console.warn(
    "getOutgoingPendingFriendRequests is deprecated under org model. Returning empty list."
  );
  return [];
}

//
// ---------------- Stats (scoped to active org)
//

export async function getPlayerBattingAverage() {
  const id = await getUserIdFromAuth();
  const orgId = await requireActiveOrgId();

  const totalHandsPlayed = await prisma.score.count({
    where: {
      userId: id,
      round: {
        game: {
          organizationId: orgId,
        },
      },
    },
  });

  const totalHandsWon = await prisma.score.count({
    where: {
      userId: id,
      blitzPileRemaining: 0,
      round: {
        game: {
          organizationId: orgId,
        },
      },
    },
  });

  const rawBattingAverage =
    totalHandsPlayed === 0 ? 0 : totalHandsWon / totalHandsPlayed;

  const battingAverage = rawBattingAverage.toFixed(3);

  return {
    totalHandsPlayed,
    totalHandsWon,
    battingAverage,
  };
}

export async function getHighestAndLowestScore() {
  const id = await getUserIdFromAuth();
  const orgId = await requireActiveOrgId();

  const scores = await prisma.$queryRaw<
    Array<{
      score: number;
      totalCardsPlayed: number;
      blitzPileRemaining: number;
    }>
  >(
    Prisma.sql`
      SELECT
        (s."totalCardsPlayed" - (s."blitzPileRemaining" * 2)) as score,
        s."totalCardsPlayed",
        s."blitzPileRemaining"
      FROM "Score" s
      JOIN "Round" r ON r."id" = s."roundId"
      JOIN "Game" g ON g."id" = r."gameId"
      WHERE s."userId" = ${id}
        AND g."organizationId" = ${orgId}
        AND (
          (s."totalCardsPlayed" - (s."blitzPileRemaining" * 2)) = (
            SELECT MAX(s2."totalCardsPlayed" - (s2."blitzPileRemaining" * 2))
            FROM "Score" s2
            JOIN "Round" r2 ON r2."id" = s2."roundId"
            JOIN "Game" g2 ON g2."id" = r2."gameId"
            WHERE s2."userId" = ${id} AND g2."organizationId" = ${orgId}
          )
          OR
          (s."totalCardsPlayed" - (s."blitzPileRemaining" * 2)) = (
            SELECT MIN(s3."totalCardsPlayed" - (s3."blitzPileRemaining" * 2))
            FROM "Score" s3
            JOIN "Round" r3 ON r3."id" = s3."roundId"
            JOIN "Game" g3 ON g3."id" = r3."gameId"
            WHERE s3."userId" = ${id} AND g3."organizationId" = ${orgId}
          )
        )
    `
  );

  if (!scores.length) {
    return { highest: null, lowest: null };
  }

  const highestScore = scores.reduce(
    (max, score) => (max.score > score.score ? max : score),
    scores[0]
  );
  const lowestScore = scores.reduce(
    (min, score) => (min.score < score.score ? min : score),
    scores[0]
  );

  const createScoreObject = (score: typeof highestScore) => ({
    score: score.score,
    totalCardsPlayed: score.totalCardsPlayed,
    blitzPileRemaining: score.blitzPileRemaining,
  });

  const highest = createScoreObject(highestScore);
  if (!lowestScore || lowestScore === highestScore) {
    return { highest, lowest: null };
  }
  const lowest = createScoreObject(lowestScore);

  return { highest, lowest };
}

export async function getCumulativeScore() {
  const id = await getUserIdFromAuth();
  const orgId = await requireActiveOrgId();

  const cumulativeScore = await prisma.score.aggregate({
    where: {
      userId: id,
      round: {
        game: {
          organizationId: orgId,
        },
      },
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

  const totalScore = totalCardsPlayed - blitzPileRemaining * 2;

  return totalScore;
}

export async function getLongestAndShortestGamesByRounds() {
  const id = await getUserIdFromAuth();
  const orgId = await requireActiveOrgId();

  const games = await prisma.game.findMany({
    where: {
      organizationId: orgId,
      players: {
        some: {
          userId: id,
        },
      },
      isFinished: true,
    },
    include: {
      rounds: true,
    },
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

  const gamesWithRounds = gamesWithRoundCount.filter(
    (game) => game.roundCount > 0
  );

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

import "server-only";

import { Prisma } from '@prisma/client';
import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import { getUserIdFromAuth } from "@/server/utils";


// Fetches users who are friends of the current user but excludes the current
// user 
export async function getFilteredUsers() {
  const id = await getUserIdFromAuth();

  const users = await prisma.user.findMany({
    where: {
      NOT: {
        OR: [
          {
            id: id,
          },
          {
            friends1: {
              some: {
                user2Id: id,
              },
            },
          },
          {
            friends2: {
              some: {
                user1Id: id,
              },
            },
          },
          {
            friendRequestsSent: {
              some: {
                receiverId: id,
              },
            },
          },
          {
            friendRequestsReceived: {
              some: {
                senderId: id,
                status: "PENDING",
              },
            },
          },
        ],
      },
    },
  });

  return users;
}

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
        },
      },
      rounds: true,
    },
    orderBy: {
      createdAt: 'desc'
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
    where: {
      id: id,
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      rounds: {
        include: {
          scores: true,
        },
      },
    },
  });

  return game;
}

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

  const result = friends.map((friend) => {
    return friend.user1Id === id ? friend.user2 : friend.user1;
  });

  return result;
}

// Get all friends of the current user and include the current user
// Used when creating a new game
export async function getFriendsForNewGame() {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    }
  });

  if (!prismaId) throw new Error("User not found");

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: prismaId.id }, { user2Id: prismaId.id }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const result = friends.map((friend) => {
    return friend.user1Id === prismaId.id ? friend.user2 : friend.user1;
  });

  return [prismaId, ...result];
}

// Get all pending friend requests
export async function getIncomingFriendRequests() {
  const id = await getUserIdFromAuth();

  const pendingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      receiverId: id,
      status: "PENDING",
    },
    include: {
      sender: true,
    },
  });

  return pendingFriendRequests;
}

// Get all friend requests that the current user has sent that are pending
export async function getOutgoingPendingFriendRequests() {
  const id = await getUserIdFromAuth();

  const outgoingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      senderId: id,
      status: "PENDING",
    },
    include: {
      receiver: true,
    },
  });

  return outgoingFriendRequests;
}

//
// ---------------- Stats
//

// Batting average
// Fetch players total rounds and rounds won
// This assumes that only one player blitzed per round (edge case)
// Maybe move this to some kind of computed property on the user model?
// https://www.prisma.io/docs/orm/prisma-client/queries/computed-fields
export async function getPlayerBattingAverage() {
  const id = await getUserIdFromAuth();

  const totalHandsPlayed = await prisma.score.count({
    where: {
      userId: id,
    },
  });

  const totalHandsWon = await prisma.score.count({
    where: {
      userId: id,
      blitzPileRemaining: 0,
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

// Highest / lowest score
export async function getHighestAndLowestScore() {
  const id = await getUserIdFromAuth();

  const scores = await prisma.$queryRaw<Array<{ score: number, totalCardsPlayed: number, blitzPileRemaining: number }>>(
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

  const highestScore = scores.reduce((max, score) => max.score > score.score ? max : score, scores[0]);
  const lowestScore = scores.reduce((min, score) => min.score < score.score ? min : score, scores[0]);

  if (!highestScore) {
    return { highest: null, lowest: null };
  }

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

// Cumulative score
export async function getCumulativeScore() {
  const id = await getUserIdFromAuth();

  const cumulativeScore = await prisma.score.aggregate({
    where: {
      userId: id,
    },
    _sum: {
      totalCardsPlayed: true,
      blitzPileRemaining: true,
    },
  });

  const totalCardsPlayed = cumulativeScore._sum.totalCardsPlayed;
  const blitzPileRemaining = cumulativeScore._sum.blitzPileRemaining;

  if (!totalCardsPlayed || !blitzPileRemaining) {
    return 0;
  }

  const totalScore = totalCardsPlayed - (blitzPileRemaining * 2);

  return totalScore;
}

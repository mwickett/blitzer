import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";


// Fetches users who are friends of the current user but excludes the current
// user 
export async function getFilteredUsers() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  // TODO: Figure out how to lookup with Clerk ID to avoid an extran DB call
  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const { id } = prismaId;

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
  const user = auth();
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
      scores: true,
    },
  });

  posthog.capture({ distinctId: user.userId, event: "get_games" });

  return games;
}

// Fetch a single game by ID
export async function getGameById(id: string) {
  const user = auth();

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
      scores: {
        include: {
          user: true,
        },
      },
    },
  });

  return game;
}

// Fetch players total rounds and rounds won
// This assumes that only one player blitzed per round (edge case)
// Maybe move this to some kind of computed property on the user model?
// https://www.prisma.io/docs/orm/prisma-client/queries/computed-fields
export async function getPlayerBattingAverage() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  // TODO: Figure out how to lookup with Clerk ID to avoid an extran DB call
  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const totalHandsPlayed = await prisma.score.count({
    where: {
      userId: prismaId.id,
    },
  });

  const totalHandsWon = await prisma.score.count({
    where: {
      userId: prismaId.id,
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

// Get all friends of the current user
export async function getFriends() {
  const user = auth();

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

  return result;
}

// Get all friends of the current user and include the current user
// Used when creating a new game
export async function getFriendsForNewGame() {
  const user = auth();

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

  // Return an empty array so we can render a message to the user
  // if (result.length === 0) {
  //   return []
  // }

  // Include user so they can add themselves
  // result.unshift(prismaId)

  return [prismaId, ...result];
}

// Get all pending friend requests
export async function getIncomingFriendRequests() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const pendingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      receiverId: prismaId.id,
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
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const outgoingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      senderId: prismaId.id,
      status: "PENDING",
    },
    include: {
      receiver: true,
    },
  });

  return outgoingFriendRequests;
}

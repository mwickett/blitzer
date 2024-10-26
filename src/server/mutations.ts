"use server";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

import { redirect } from "next/navigation";

// Create a new game
export async function createGame(users: { id: string }[]) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.create({
    data: {
      players: {
        create: users.map((user) => ({
          user: {
            connect: {
              id: user.id,
            },
          },
        })),
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  posthog.capture({ distinctId: user.userId, event: "create_game" });

  redirect(`/games/${game.id}`);
}

// Create new round with scores
export async function createRoundForGame(
  gameId: string,
  roundNumber: number,
  scores: {
    userId: string;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[]
) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });
  
  if (!game) {
    throw new Error("Game not found");
  }

  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      round: roundNumber,
      scores: {
        create: scores.map((score) => ({
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
          user: {
            connect: { id: score.userId }
          },
        })),
      },
    },
  })

  posthog.capture({ distinctId: user.userId, event: "create_scores" });

  return round;
}

// Update game as finished
export async function updateGameAsFinished(gameId: string, winnerId: string) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  await prisma.game.update({
    where: {
      id: gameId,
    },
    data: {
      isFinished: true,
      winnerId: winnerId,
      endedAt: new Date(),
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "update_game_as_finished",
    properties: {
      gameId: gameId,
      winnerId: winnerId,
    },
  });
}

// Create friend request
export async function createFriendRequest(userId: string) {
  const user = await auth();
  const posthog = posthogClient();

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

  const { id } = prismaId;

  await prisma.friendRequest.create({
    data: {
      senderId: id,
      receiverId: userId,
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "create_friend_request",
    properties: { userId: userId },
  });

  redirect(`/friends`);
}

// Accept friend request
export async function acceptFriendRequest(friendRequestId: string) {
  const user = await auth();
  const posthog = posthogClient();

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

  const { id } = prismaId;

  const friendRequest = await prisma.friendRequest.findUnique({
    where: {
      id: friendRequestId,
    },
    select: {
      senderId: true,
      receiverId: true,
    },
  });

  if (!friendRequest) throw new Error("Friend request not found");

  await prisma.friend.create({
    data: {
      user1Id: id,
      user2Id: friendRequest.senderId,
    },
  });

  await prisma.friendRequest.update({
    where: {
      id: friendRequestId,
    },
    data: {
      status: "ACCEPTED",
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "accept_friend_request",
    properties: { friendRequestId: friendRequestId },
  });
}

// Reject friend request
export async function rejectFriendRequest(friendRequestId: string) {
  const user = await auth();
  const posthog = posthogClient();

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

  const friendRequest = await prisma.friendRequest.findUnique({
    where: {
      id: friendRequestId,
    },
    select: {
      receiverId: true,
    },
  });

  if (!friendRequest) throw new Error("Friend request not found");
  if (friendRequest.receiverId !== prismaId.id) throw new Error("Unauthorized");

  await prisma.friendRequest.update({
    where: {
      id: friendRequestId,
    },
    data: {
      status: "REJECTED",
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "reject_friend_request",
    properties: { friendRequestId: friendRequestId },
  });
}

// Clone an existing game
export async function cloneGame(originalGameId: string) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  // Fetch the original game with its players
  const originalGame = await prisma.game.findUnique({
    where: { id: originalGameId },
    include: { players: true }
  });

  if (!originalGame) throw new Error("Original game not found");

  // Extract player IDs from the original game
  const players = originalGame.players.map(player => ({ id: player.userId }));

  // Create a new game with the same players
  const newGame = await prisma.game.create({
    data: {
      players: {
        create: players.map(player => ({
          user: { connect: { id: player.id } }
        })),
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  posthog.capture({ distinctId: user.userId, event: "clone_game", properties: { originalGameId, newGameId: newGame.id } });

  return newGame.id
}

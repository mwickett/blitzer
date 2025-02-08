"use server";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

import { redirect } from "next/navigation";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { sendFriendRequestEmail, sendGameCompleteEmail } from "./email";

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

  // Validate scores using centralized validation
  try {
    validateGameRules(scores);
  } catch (error) {
    if (error instanceof ValidationError) {
      posthog.capture({
        distinctId: user.userId,
        event: "validation_error",
        properties: {
          error: error.message,
          scores,
          gameId,
          roundNumber,
          type: "game_rules",
        },
      });
      throw error; // These will have user-friendly messages
    }
    throw new Error("Invalid score submission");
  }

  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      round: roundNumber,
      scores: {
        create: scores.map((score) => ({
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
          updatedAt: new Date(),
          user: {
            connect: { id: score.userId },
          },
        })),
      },
    },
  });

  posthog.capture({ distinctId: user.userId, event: "create_scores" });

  return round;
}

// Update game as finished
export async function updateGameAsFinished(gameId: string, winnerId: string) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  // Fetch game with all player details
  const game = await prisma.game.findUnique({
    where: {
      id: gameId,
    },
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (!game) throw new Error("Game not found");

  // Get winner's details
  const winner = await prisma.user.findUnique({
    where: {
      id: winnerId,
    },
    select: {
      username: true,
    },
  });

  if (!winner) throw new Error("Winner not found");

  // Update game as finished
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

  // Send emails to all players
  await Promise.all(
    game.players.map((player) =>
      sendGameCompleteEmail({
        email: player.user.email,
        username: player.user.username,
        winnerUsername: winner.username,
        isWinner: player.user.id === winnerId,
        gameId,
      })
    )
  );

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

  // Get target user with email
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Get sender's username
  const sender = await prisma.user.findUnique({
    where: { id },
    select: {
      username: true,
    },
  });

  if (!sender) {
    throw new Error("Sender not found");
  }

  // Check if trying to send request to self
  if (id === userId) {
    throw new Error("Cannot send friend request to yourself");
  }

  // Check if already friends
  const existingFriendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { user1Id: id, user2Id: userId },
        { user1Id: userId, user2Id: id },
      ],
    },
  });

  if (existingFriendship) {
    throw new Error("Already friends with this user");
  }

  // Check if request already exists
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: id, receiverId: userId },
        { senderId: userId, receiverId: id },
      ],
      status: "PENDING",
    },
  });

  if (existingRequest) {
    throw new Error("Friend request already exists");
  }

  const friendRequest = await prisma.friendRequest.create({
    data: {
      senderId: id,
      receiverId: userId,
    },
  });

  // Send friend request email
  const emailResult = await sendFriendRequestEmail({
    email: targetUser.email,
    username: targetUser.username,
    fromUsername: sender.username,
  });

  if (!emailResult.success) {
    console.error("Friend request email failed:", emailResult.error);
    // Continue since friend request was created successfully
  }

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
  if (friendRequest.receiverId !== id) {
    throw new Error("Unauthorized - not the receiver");
  }

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
  if (friendRequest.receiverId !== prismaId.id)
    throw new Error("Unauthorized - not the receiver");

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
    include: { players: true },
  });

  if (!originalGame) throw new Error("Original game not found");

  // Extract player IDs from the original game
  const players = originalGame.players.map((player) => ({ id: player.userId }));

  // Create a new game with the same players
  const newGame = await prisma.game.create({
    data: {
      players: {
        create: players.map((player) => ({
          user: { connect: { id: player.id } },
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

  posthog.capture({
    distinctId: user.userId,
    event: "clone_game",
    properties: { originalGameId, newGameId: newGame.id },
  });

  return newGame.id;
}

// Update scores for a round
export async function updateRoundScores(
  gameId: string,
  roundId: string,
  scores: {
    userId: string;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[]
) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  // Check if game exists and is not finished
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.isFinished) {
    throw new Error("Cannot update scores for a finished game");
  }

  // Validate scores using centralized validation
  try {
    validateGameRules(scores);
  } catch (error) {
    if (error instanceof ValidationError) {
      posthog.capture({
        distinctId: user.userId,
        event: "validation_error",
        properties: {
          error: error.message,
          scores,
          gameId,
          roundId,
          type: "game_rules",
        },
      });
      throw error; // These will have user-friendly messages
    }
    throw new Error("Invalid score submission");
  }

  // Update scores in a transaction to ensure consistency
  const updatedScores = await prisma.$transaction(
    scores.map((score) =>
      prisma.score.updateMany({
        where: {
          roundId: roundId,
          userId: score.userId,
        },
        data: {
          blitzPileRemaining: score.blitzPileRemaining,
          totalCardsPlayed: score.totalCardsPlayed,
          updatedAt: new Date(),
        },
      })
    )
  );

  posthog.capture({
    distinctId: user.userId,
    event: "update_scores",
    properties: {
      gameId: gameId,
      roundId: roundId,
    },
  });

  return updatedScores;
}

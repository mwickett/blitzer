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

  // Validate scores
  // Validate min/max values for each score
  const invalidScores = scores.some(
    (score) =>
      score.blitzPileRemaining < 0 ||
      score.blitzPileRemaining > 10 ||
      score.totalCardsPlayed < 0 ||
      score.totalCardsPlayed > 40
  );
  if (invalidScores) {
    throw new Error(
      "Invalid scores: Blitz pile must be 0-10 cards, total cards played must be 0-40"
    );
  }

  // Validate at least one player has blitzed
  const atLeastOneBlitzed = scores.some(
    (score) => score.blitzPileRemaining === 0
  );
  if (!atLeastOneBlitzed) {
    throw new Error("At least one player must blitz (have 0 cards remaining)");
  }

  // Validate players who blitz have played enough cards
  const invalidBlitzScores = scores.some(
    (score) => score.blitzPileRemaining === 0 && score.totalCardsPlayed < 6
  );
  if (invalidBlitzScores) {
    throw new Error("Players who blitz must play at least 6 cards");
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

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
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

  // Validate scores
  // Validate min/max values for each score
  const invalidScores = scores.some(
    (score) =>
      score.blitzPileRemaining < 0 ||
      score.blitzPileRemaining > 10 ||
      score.totalCardsPlayed < 0 ||
      score.totalCardsPlayed > 40
  );
  if (invalidScores) {
    throw new Error(
      "Invalid scores: Blitz pile must be 0-10 cards, total cards played must be 0-40"
    );
  }

  // Validate at least one player has blitzed
  const atLeastOneBlitzed = scores.some(
    (score) => score.blitzPileRemaining === 0
  );
  if (!atLeastOneBlitzed) {
    throw new Error("At least one player must blitz (have 0 cards remaining)");
  }

  // Validate players who blitz have played enough cards
  const invalidBlitzScores = scores.some(
    (score) => score.blitzPileRemaining === 0 && score.totalCardsPlayed < 6
  );
  if (invalidBlitzScores) {
    throw new Error("Players who blitz must play at least 6 cards");
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

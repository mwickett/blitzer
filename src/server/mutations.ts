"use server";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

import { redirect } from "next/navigation";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { sendFriendRequestEmail, sendGameCompleteEmail } from "./email";

// Create a new game with support for guest players
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[]
) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  // Get the authenticated user's internal ID
  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  try {
    // Step 1: First create an empty game
    const newGame = await prisma.game.create({
      data: {},
    });

    // Step 2: Create guest users if needed
    const guestUserIds = new Map();
    for (const player of users) {
      if (player.isGuest && player.username) {
        const guestUser = await prisma.guestUser.create({
          data: {
            name: player.username,
            createdById: currentUser.id,
          },
        });
        guestUserIds.set(player.id, guestUser.id);
      }
    }

    // Step 3: Add players to the game one by one
    for (const player of users) {
      if (player.isGuest) {
        const dbGuestId = guestUserIds.get(player.id);
        if (dbGuestId) {
          // For guest players, omit userId entirely
          await prisma.gamePlayers.create({
            data: {
              gameId: newGame.id,
              guestId: dbGuestId,
            },
          });
        }
      } else {
        // For regular players, omit guestId entirely
        await prisma.gamePlayers.create({
          data: {
            gameId: newGame.id,
            userId: player.id,
          },
        });
      }
    }

    // Track event in PostHog
    posthog.capture({
      distinctId: user.userId,
      event: "create_game",
      properties: {
        gameId: newGame.id,
        playerCount: users.length,
        guestPlayerCount: users.filter((u) => u.isGuest).length,
      },
    });

    // Return the game ID instead of redirecting
    // This prevents the NEXT_REDIRECT error in the logs
    return { gameId: newGame.id };
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

// Create new round with scores
export async function createRoundForGame(
  gameId: string,
  roundNumber: number,
  scores: {
    userId?: string;
    guestId?: string;
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

  // Create scores individually to avoid null constraint issues
  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      round: roundNumber,
    },
  });

  // Add scores one by one after round is created
  for (const score of scores) {
    if (!score.userId && !score.guestId) {
      console.error("Score missing both userId and guestId:", score);
      continue; // Skip this score and continue with others
    }

    const scoreData = {
      roundId: round.id,
      blitzPileRemaining: score.blitzPileRemaining,
      totalCardsPlayed: score.totalCardsPlayed,
      updatedAt: new Date(),
    };

    try {
      if (score.userId) {
        await prisma.score.create({
          data: {
            ...scoreData,
            userId: score.userId,
          },
        });
      } else if (score.guestId) {
        await prisma.score.create({
          data: {
            ...scoreData,
            guestId: score.guestId,
          },
        });
      }
    } catch (error) {
      console.error("Error creating score:", error, score);
      // Continue with other scores even if one fails
    }
  }

  posthog.capture({ distinctId: user.userId, event: "create_scores" });

  return round;
}

// Update game as finished
export async function updateGameAsFinished(
  gameId: string,
  winnerId: string,
  isGuestWinner: boolean = false
) {
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
              clerk_user_id: true,
            },
          },
          guestUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!game) throw new Error("Game not found");

  // Get winner's details
  let winnerName = "";

  if (isGuestWinner) {
    const winner = await prisma.guestUser.findUnique({
      where: { id: winnerId },
      select: { name: true },
    });
    if (!winner) throw new Error("Guest winner not found");
    winnerName = winner.name;
  } else {
    const winner = await prisma.user.findUnique({
      where: { id: winnerId },
      select: { username: true },
    });
    if (!winner) throw new Error("Winner not found");
    winnerName = winner.username;
  }

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

  // Send emails to all registered players (can't send to guests)
  // Process emails sequentially with delay to avoid rate limits
  const registeredPlayers = game.players.filter((player) => player.user);

  // Track email batch in PostHog
  posthog.capture({
    distinctId: user.userId,
    event: "email_batch_started",
    properties: {
      gameId,
      emailType: "game_complete",
      recipientCount: registeredPlayers.length,
      winnerName,
      isGuestWinner,
    },
  });

  for (let i = 0; i < registeredPlayers.length; i++) {
    const player = registeredPlayers[i];
    const userEmail = player.user!.email;
    const username = player.user!.username;
    const userId = player.user!.id;
    // Use clerk_user_id if available for consistent tracking
    const userClerkId = player.user!.clerk_user_id || user.userId;

    try {
      await sendGameCompleteEmail({
        email: userEmail,
        username: username,
        winnerUsername: winnerName,
        isWinner: isGuestWinner ? false : userId === winnerId,
        gameId,
        userId: userClerkId,
      });

      // Add delay between email sends to avoid rate limiting (Resend limit is 2 per second)
      if (i < registeredPlayers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600)); // 600ms delay between emails
      }
    } catch (error) {
      console.error(`Failed to send email to ${username}:`, error);
      // Track individual email failure
      posthog.capture({
        distinctId: user.userId,
        event: "email_batch_item_failed",
        properties: {
          gameId,
          recipientEmail: userEmail,
          recipientUsername: username,
          recipientId: userId,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      // Continue with other emails even if one fails
    }
  }

  // Track email batch completion
  posthog.capture({
    distinctId: user.userId,
    event: "email_batch_completed",
    properties: {
      gameId,
      emailType: "game_complete",
      recipientCount: registeredPlayers.length,
      winnerName,
      isGuestWinner,
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "update_game_as_finished",
    properties: {
      gameId: gameId,
      winnerId: winnerId,
      isGuestWinner: isGuestWinner,
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
    userId: user.userId,
  });

  if (!emailResult.success) {
    console.error("Friend request email failed:", emailResult.error);
    // Track email failure in PostHog
    posthog.capture({
      distinctId: user.userId,
      event: "friend_request_email_failed",
      properties: {
        receiverEmail: targetUser.email,
        receiverUsername: targetUser.username,
        receiverId: targetUser.id,
        errorMessage: emailResult.error,
      },
    });
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
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
    },
  });

  if (!originalGame) throw new Error("Original game not found");

  // Start a transaction to ensure consistency
  const newGameId = await prisma.$transaction(async (tx) => {
    // Create a new game with the same players
    const playerCreateInputs = originalGame.players.map((player) => {
      if (player.userId) {
        return { userId: player.userId };
      } else if (player.guestId) {
        return { guestId: player.guestId };
      }
      throw new Error("Player has neither userId nor guestId");
    });

    const newGame = await tx.game.create({
      data: {
        players: {
          create: playerCreateInputs,
        },
      },
    });

    return newGame.id;
  });

  posthog.capture({
    distinctId: user.userId,
    event: "clone_game",
    properties: { originalGameId, newGameId },
  });

  return newGameId;
}

// Update scores for a round
export async function updateRoundScores(
  gameId: string,
  roundId: string,
  scores: {
    userId?: string;
    guestId?: string;
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
  const updatedScores = await prisma.$transaction(async (tx) => {
    const results = [];

    for (const score of scores) {
      if (score.userId) {
        const result = await tx.score.updateMany({
          where: {
            roundId: roundId,
            userId: score.userId,
          },
          data: {
            blitzPileRemaining: score.blitzPileRemaining,
            totalCardsPlayed: score.totalCardsPlayed,
            updatedAt: new Date(),
          },
        });
        results.push(result);
      } else if (score.guestId) {
        const result = await tx.score.updateMany({
          where: {
            roundId: roundId,
            guestId: score.guestId,
          },
          data: {
            blitzPileRemaining: score.blitzPileRemaining,
            totalCardsPlayed: score.totalCardsPlayed,
            updatedAt: new Date(),
          },
        });
        results.push(result);
      } else {
        throw new Error("Score must have either userId or guestId");
      }
    }

    return results;
  });

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

// Create a guest user
export async function createGuestUser(name: string) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  const guestUser = await prisma.guestUser.create({
    data: {
      name,
      createdById: currentUser.id,
    },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "create_guest_user",
    properties: { guestId: guestUser.id, guestName: name },
  });

  return guestUser;
}

// Get guest users created by the current user
export async function getMyGuestUsers() {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  const guestUsers = await prisma.guestUser.findMany({
    where: { createdById: currentUser.id },
    orderBy: { createdAt: "desc" },
  });

  return guestUsers;
}

// Send invitation to a guest user
export async function inviteGuestUser(guestId: string, email: string) {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");

  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  // Check if user owns this guest
  const guestUser = await prisma.guestUser.findUnique({
    where: { id: guestId },
    select: { createdById: true, name: true },
  });

  if (!guestUser) throw new Error("Guest user not found");
  if (guestUser.createdById !== currentUser.id)
    throw new Error("Unauthorized - not the creator of this guest");

  // Update guest with invitation details
  await prisma.guestUser.update({
    where: { id: guestId },
    data: {
      invitationSent: true,
      invitationSentAt: new Date(),
      emailSent: email,
    },
  });

  // TODO: Implement email sending for guest invitation
  // For now, record the event in PostHog
  posthog.capture({
    distinctId: user.userId,
    event: "invite_guest_user",
    properties: {
      guestId,
      email,
      guestName: guestUser.name,
    },
  });

  return { success: true };
}

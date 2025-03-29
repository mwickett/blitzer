"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUser, getAuthenticatedUserPrismaId } from "./common";
import { sendGameCompleteEmail } from "../email";

// Create a new game with support for guest players
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[]
) {
  const { user, posthog } = await getAuthenticatedUser();
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

// Update game as finished
export async function updateGameAsFinished(
  gameId: string,
  winnerId: string,
  isGuestWinner: boolean = false
) {
  const { user, posthog } = await getAuthenticatedUser();

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

// Clone an existing game
export async function cloneGame(originalGameId: string) {
  const { user, posthog } = await getAuthenticatedUser();

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

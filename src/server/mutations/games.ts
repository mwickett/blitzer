"use server";

import prisma from "@/server/db/db";
import { clerkClient } from "@clerk/nextjs/server";
import { getAuthenticatedUserWithOrg } from "./common";
import { sendGameCompleteEmail, EMAIL_INTER_SEND_DELAY_MS } from "../email";
import { resolvePlayerColor, assignColorsToPlayers } from "@/lib/scoring/colors";

// Create a new game with support for guest players
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[],
  winThreshold?: number
) {
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();
  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  // Validate that non-guest players are members of the active circle
  const regularPlayerIds = users
    .filter((u) => !u.isGuest)
    .map((u) => u.id);

  if (regularPlayerIds.length > 0) {
    const client = await clerkClient();
    const memberships =
      await client.organizations.getOrganizationMembershipList({
        organizationId: orgId,
      });

    const memberClerkIds = new Set(
      memberships.data
        .map((m) => m.publicUserData?.userId)
        .filter(Boolean)
    );

    // Look up clerk_user_ids for the submitted player Prisma IDs
    const players = await prisma.user.findMany({
      where: { id: { in: regularPlayerIds } },
      select: { id: true, clerk_user_id: true },
    });

    for (const player of players) {
      if (!memberClerkIds.has(player.clerk_user_id)) {
        throw new Error("All players must be members of the active circle");
      }
    }
  }

  try {
    // Step 1: First create a game (with optional custom win threshold)
    const newGame = await prisma.game.create({
      data: {
        organizationId: orgId,
        ...(winThreshold && winThreshold !== 75 ? { winThreshold } : {}),
      },
    });

    // Step 2: Create guest users if needed
    const guestUserIds = new Map();
    for (const player of users) {
      if (player.isGuest && player.username) {
        const guestUser = await prisma.guestUser.create({
          data: {
            name: player.username,
            createdById: currentUser.id,
            organizationId: orgId,
          },
        });
        guestUserIds.set(player.id, guestUser.id);
      }
    }

    // Step 3: Resolve accent colors for all players
    // Look up accent color defaults for regular players
    const playerDefaults = await prisma.user.findMany({
      where: { id: { in: regularPlayerIds } },
      select: { id: true, accentColor: true },
    });

    // Resolve colors: game override (none at creation) > user default > auto-assign
    const colorInputs = users.map((u) => {
      const userDefault = playerDefaults.find((p) => p.id === u.id);
      return {
        id: u.id,
        resolvedColor: resolvePlayerColor({
          gameColor: null,
          userDefault: userDefault?.accentColor ?? null,
        }),
      };
    });
    const playerColors = assignColorsToPlayers(colorInputs);

    // Step 4: Add players to the game one by one
    for (const player of users) {
      if (player.isGuest) {
        const dbGuestId = guestUserIds.get(player.id);
        if (dbGuestId) {
          // For guest players, omit userId entirely
          await prisma.gamePlayers.create({
            data: {
              gameId: newGame.id,
              guestId: dbGuestId,
              accentColor: playerColors[player.id] ?? null,
            },
          });
        }
      } else {
        // For regular players, omit guestId entirely
        await prisma.gamePlayers.create({
          data: {
            gameId: newGame.id,
            userId: player.id,
            accentColor: playerColors[player.id] ?? null,
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
        win_threshold: winThreshold ?? 75,
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
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

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

  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }

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
        await new Promise((resolve) => setTimeout(resolve, EMAIL_INTER_SEND_DELAY_MS)); // delay between emails to avoid rate limiting
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

// Save user's default accent color preference
export async function saveUserAccentColor(color: string) {
  const { user, posthog } = await getAuthenticatedUserWithOrg();
  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
  });
  if (!currentUser) throw new Error("User not found");

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { accentColor: color },
  });

  posthog.capture({
    distinctId: user.userId,
    event: "set_accent_color",
    properties: { color },
  });
}

// Clone an existing game
export async function cloneGame(originalGameId: string) {
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

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

  if (originalGame.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }

  // Start a transaction to ensure consistency
  const newGameId = await prisma.$transaction(async (tx) => {
    // Create a new game with the same players
    const playerCreateInputs = originalGame.players.map((player) => {
      if (player.userId) {
        return {
          userId: player.userId,
          ...(player.accentColor ? { accentColor: player.accentColor } : {}),
        };
      } else if (player.guestId) {
        return {
          guestId: player.guestId,
          ...(player.accentColor ? { accentColor: player.accentColor } : {}),
        };
      }
      throw new Error("Player has neither userId nor guestId");
    });

    const newGame = await tx.game.create({
      data: {
        organizationId: orgId,
        ...(originalGame.winThreshold !== 75
          ? { winThreshold: originalGame.winThreshold }
          : {}),
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

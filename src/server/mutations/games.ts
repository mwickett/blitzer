"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUser, requireActiveOrgId } from "./common";
import { sendGameCompleteEmail } from "../email";

// Create a new game with support for guest players, scoped to active org
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[]
) {
  const { user, posthog } = await getAuthenticatedUser();
  const orgId = await requireActiveOrgId();

  const currentUser = await prisma.user.findUnique({
    where: { clerk_user_id: user.userId },
    select: { id: true },
  });

  if (!currentUser) throw new Error("User not found");

  // Validate all non-guest players belong to the active org
  const nonGuestUserIds = users.filter((u) => !u.isGuest).map((u) => u.id);
  if (nonGuestUserIds.length > 0) {
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId, userId: { in: nonGuestUserIds } },
      select: { userId: true },
    });

    const memberIds = new Set(memberships.map((m) => m.userId));
    const invalid = nonGuestUserIds.filter((id) => !memberIds.has(id));
    if (invalid.length > 0) {
      throw new Error(
        "Some selected players are not members of the active organization"
      );
    }
  }

  try {
    // Step 1: create game with organization
    const newGame = await prisma.game.create({
      data: {
        organizationId: orgId,
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
          await prisma.gamePlayers.create({
            data: {
              gameId: newGame.id,
              guestId: dbGuestId,
            },
          });
        }
      } else {
        await prisma.gamePlayers.create({
          data: {
            gameId: newGame.id,
            userId: player.id,
          },
        });
      }
    }

    posthog.capture({
      distinctId: user.userId,
      event: "create_game",
      properties: {
        gameId: newGame.id,
        playerCount: users.length,
        guestPlayerCount: users.filter((u) => u.isGuest).length,
        organizationId: orgId,
      },
      groups: { organization: orgId },
    });

    return { gameId: newGame.id };
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

// Update game as finished (unchanged)
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

  const orgId = (game as any).organizationId;

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

  const registeredPlayers = game.players.filter((player) => player.user);

  posthog.capture({
    distinctId: user.userId,
    event: "email_batch_started",
    properties: {
      gameId,
      emailType: "game_complete",
      recipientCount: registeredPlayers.length,
      winnerName,
      isGuestWinner,
      organizationId: orgId || undefined,
    },
    groups: orgId ? { organization: orgId } : undefined,
  });

  for (let i = 0; i < registeredPlayers.length; i++) {
    const player = registeredPlayers[i];
    const userEmail = player.user!.email;
    const username = player.user!.username;
    const userId = player.user!.id;
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

      if (i < registeredPlayers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch (error) {
      console.error(`Failed to send email to ${username}:`, error);
      posthog.capture({
        distinctId: user.userId,
        event: "email_batch_item_failed",
        properties: {
          gameId,
          recipientEmail: userEmail,
          recipientUsername: username,
          recipientId: userId,
          errorMessage: error instanceof Error ? error.message : String(error),
          organizationId: orgId || undefined,
        },
        groups: orgId ? { organization: orgId } : undefined,
      });
    }
  }

  posthog.capture({
    distinctId: user.userId,
    event: "email_batch_completed",
    properties: {
      gameId,
      emailType: "game_complete",
      recipientCount: registeredPlayers.length,
      winnerName,
      isGuestWinner,
      organizationId: orgId || undefined,
    },
    groups: orgId ? { organization: orgId } : undefined,
  });

  posthog.capture({
    distinctId: user.userId,
    event: "update_game_as_finished",
    properties: {
      gameId: gameId,
      winnerId: winnerId,
      isGuestWinner: isGuestWinner,
      organizationId: orgId || undefined,
    },
    groups: orgId ? { organization: orgId } : undefined,
  });
}

// Clone an existing game within the same org
export async function cloneGame(originalGameId: string) {
  const { user, posthog } = await getAuthenticatedUser();
  const orgId = await requireActiveOrgId();

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
    throw new Error("Cannot clone game from a different organization");
  }

  const newGameId = await prisma.$transaction(async (tx) => {
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
        organizationId: originalGame.organizationId,
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
    properties: { originalGameId, newGameId, organizationId: orgId },
    groups: { organization: orgId },
  });

  return newGameId;
}

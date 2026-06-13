"use server";

import prisma from "@/server/db/db";
import { Prisma } from "@/generated/prisma/client";
import { after } from "next/server";
import { requireAuthContext, assertGameInCircle } from "./common";
import { getOrgMemberClerkIds } from "../clerkOrgs";
import { sendGameCompleteEmail, EMAIL_INTER_SEND_DELAY_MS } from "../email";
import { resolvePlayerColor, assignColorsToPlayers } from "@/lib/scoring/colors";
import { scheduleGameSummary } from "@/server/ai/summary";

// Create a new game with support for guest players
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
    accentColor?: string;
  }[],
  winThreshold?: number
) {
  const { user, posthog, orgId, prismaUserId } = await requireAuthContext(
    "orgWithPrismaId"
  );

  const regularPlayerIds = users
    .filter((u) => !u.isGuest)
    .map((u) => u.id);

  // One lookup serves both membership validation and accent-color defaults
  const regularPlayers =
    regularPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: regularPlayerIds } },
          select: { id: true, clerk_user_id: true, accentColor: true },
        })
      : [];

  // Validate that non-guest players are members of the active circle
  if (regularPlayerIds.length > 0) {
    const memberClerkIds = await getOrgMemberClerkIds(orgId);

    for (const player of regularPlayers) {
      if (!memberClerkIds.has(player.clerk_user_id)) {
        throw new Error("All players must be members of the active circle");
      }
    }
  }

  // Resolve colors: game override (none at creation) > user default > auto-assign
  const colorInputs = users.map((u) => {
    const userDefault = regularPlayers.find((p) => p.id === u.id);
    return {
      id: u.id,
      resolvedColor: u.accentColor ?? resolvePlayerColor({
        gameColor: null,
        userDefault: userDefault?.accentColor ?? null,
      }),
    };
  });
  const playerColors = assignColorsToPlayers(colorInputs);

  try {
    // Game, guests, and players are created atomically so a failure part-way
    // through can't leave an orphaned game behind
    const newGame = await prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          organizationId: orgId,
          ...(winThreshold && winThreshold !== 75 ? { winThreshold } : {}),
        },
      });

      // Guests need individual creates to map their temporary client-side
      // IDs to real rows (createMany does not return rows)
      const guestDbIds = new Map<string, string>();
      for (const player of users) {
        if (player.isGuest && player.username) {
          const guestUser = await tx.guestUser.create({
            data: {
              name: player.username,
              createdById: prismaUserId,
              organizationId: orgId,
            },
          });
          guestDbIds.set(player.id, guestUser.id);
        }
      }

      const playerRows = users.flatMap(
        (player): Prisma.GamePlayersCreateManyInput[] => {
          const accentColor = playerColors[player.id] ?? null;
          if (player.isGuest) {
            const guestId = guestDbIds.get(player.id);
            return guestId ? [{ gameId: game.id, guestId, accentColor }] : [];
          }
          return [{ gameId: game.id, userId: player.id, accentColor }];
        }
      );

      await tx.gamePlayers.createMany({ data: playerRows });

      return game;
    });

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
  const { user, posthog, orgId } = await requireAuthContext("org");

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

  assertGameInCircle(game, orgId);

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

  posthog.capture({
    distinctId: user.userId,
    event: "update_game_as_finished",
    properties: {
      gameId: gameId,
      winnerId: winnerId,
      isGuestWinner: isGuestWinner,
    },
  });

  // Generate the post-game recap. Flag-gated; writes a durable pending row now
  // (primary, in-request) and runs the LLM after the response is sent.
  // Best-effort: a summary failure must never fail the game finish.
  try {
    await scheduleGameSummary(gameId);
  } catch (error) {
    console.error("[insights] failed to schedule game summary", error);
  }

  // Schedule emails after the response is sent — the platform keeps the
  // runtime alive until the callback resolves (replaces fire-and-forget IIFE).
  const registeredPlayers = game.players.filter((player) => player.user);

  after(async () => {
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
      const pUserId = player.user!.id;
      const userClerkId = player.user!.clerk_user_id || user.userId;

      try {
        await sendGameCompleteEmail({
          email: userEmail,
          username: username,
          winnerUsername: winnerName,
          isWinner: isGuestWinner ? false : pUserId === winnerId,
          gameId,
          userId: userClerkId,
        });

        if (i < registeredPlayers.length - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, EMAIL_INTER_SEND_DELAY_MS)
          );
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
            recipientId: pUserId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
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
      },
    });
  });
}

// Save user's default accent color preference
export async function saveUserAccentColor(color: string) {
  const { user, posthog, prismaUserId } = await requireAuthContext(
    "orgWithPrismaId"
  );

  await prisma.user.update({
    where: { id: prismaUserId },
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
  const { user, posthog, orgId } = await requireAuthContext("org");

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
  assertGameInCircle(originalGame, orgId);

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

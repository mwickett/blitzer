"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUser, getAuthenticatedUserPrismaId } from "./common";

/**
 * Create a new key moment for a game
 */
export async function createKeyMoment(
  gameId: string,
  imageUrl: string,
  description?: string,
  roundId?: string
) {
  const { userId, id: prismaUserId, posthog } = await getAuthenticatedUserPrismaId();

  // Verify the game exists
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  // If roundId is provided, verify it belongs to the game
  if (roundId) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round || round.gameId !== gameId) {
      throw new Error("Round not found or does not belong to this game");
    }
  }

  // Create the key moment
  const keyMoment = await prisma.keyMoment.create({
    data: {
      gameId,
      roundId: roundId || null,
      uploadedByUserId: prismaUserId,
      imageUrl,
      description: description || null,
    },
  });

  // Track event in PostHog
  posthog.capture({
    distinctId: userId,
    event: "create_key_moment",
    properties: {
      gameId,
      roundId: roundId || null,
      hasDescription: !!description,
      keyMomentId: keyMoment.id,
    },
  });

  return keyMoment;
}

/**
 * Get all key moments for a game
 */
export async function getKeyMomentsForGame(gameId: string) {
  await getAuthenticatedUser(); // Ensure user is authenticated

  const keyMoments = await prisma.keyMoment.findMany({
    where: { gameId },
    include: {
      uploadedBy: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      round: {
        select: {
          id: true,
          round: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return keyMoments;
}

/**
 * Delete a key moment (only the uploader can delete)
 */
export async function deleteKeyMoment(keyMomentId: string) {
  const { userId, id: prismaUserId, posthog } = await getAuthenticatedUserPrismaId();

  // Get the key moment
  const keyMoment = await prisma.keyMoment.findUnique({
    where: { id: keyMomentId },
  });

  if (!keyMoment) {
    throw new Error("Key moment not found");
  }

  // Check if the user is the uploader
  if (keyMoment.uploadedByUserId !== prismaUserId) {
    throw new Error("You can only delete your own key moments");
  }

  // Delete the key moment
  await prisma.keyMoment.delete({
    where: { id: keyMomentId },
  });

  // Track event in PostHog
  posthog.capture({
    distinctId: userId,
    event: "delete_key_moment",
    properties: {
      keyMomentId,
      gameId: keyMoment.gameId,
    },
  });

  return { success: true };
}

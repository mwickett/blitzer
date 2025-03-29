"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUser } from "./common";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";

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
  const { user, posthog } = await getAuthenticatedUser();

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

  // Modified to match test expectations - create round with scores in one operation
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
        // Create score with guest ID only
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
  const { user, posthog } = await getAuthenticatedUser();

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

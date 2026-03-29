"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUserWithOrg } from "./common";
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
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  // Verify game belongs to the active circle
  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
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

  // Create round — the @@unique([gameId, round]) constraint prevents duplicates.
  // If a duplicate is attempted (e.g. double-tap), return the existing round.
  let round;
  try {
    round = await prisma.round.create({
      data: {
        gameId: game.id,
        round: roundNumber,
      },
    });
  } catch (error) {
    // Unique constraint violation — round already exists (double submit)
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const existing = await prisma.round.findFirst({
        where: { gameId: game.id, round: roundNumber },
      });
      if (existing) return existing;
    }
    throw error;
  }

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

// Delete the latest round (for undo support)
export async function deleteLatestRound(gameId: string) {
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        orderBy: { round: "desc" },
        take: 1,
        include: { scores: true },
      },
    },
  });

  if (!game) throw new Error("Game not found");
  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }

  const latestRound = game.rounds[0];
  if (!latestRound) throw new Error("No rounds to undo");

  await prisma.$transaction(async (tx) => {
    await tx.score.deleteMany({ where: { roundId: latestRound.id } });
    await tx.round.delete({ where: { id: latestRound.id } });

    if (game.isFinished) {
      await tx.game.update({
        where: { id: gameId },
        data: { isFinished: false, winnerId: null, endedAt: null },
      });
    }
  });

  posthog.capture({
    distinctId: user.userId,
    event: "undo_round",
    properties: { game_id: gameId, round_number: latestRound.round },
  });

  return { deletedRoundNumber: latestRound.round };
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
  const { user, posthog, orgId } = await getAuthenticatedUserWithOrg();

  // Check if game exists and is not finished
  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
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

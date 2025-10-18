"use server";

import prisma from "@/server/db/db";
import { getAuthenticatedUser, requireActiveOrgId } from "./common";
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
  const orgId = await requireActiveOrgId();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.organizationId !== orgId) {
    throw new Error("Unauthorized for this organization");
  }

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
      throw error;
    }
    throw new Error("Invalid score submission");
  }

  const round = await prisma.round.create({
    data: {
      gameId: game.id,
      round: roundNumber,
    },
  });

  for (const score of scores) {
    if (!score.userId && !score.guestId) {
      console.error("Score missing both userId and guestId:", score);
      continue;
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
    }
  }

  posthog.capture({
    distinctId: user.userId,
    event: "create_scores",
    properties: { gameId, roundNumber, organizationId: orgId },
    groups: { organization: orgId },
  });

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
  const orgId = await requireActiveOrgId();

  const game = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.isFinished) {
    throw new Error("Cannot update scores for a finished game");
  }

  if (game.organizationId !== orgId) {
    throw new Error("Unauthorized for this organization");
  }

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
      throw error;
    }
    throw new Error("Invalid score submission");
  }

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
      organizationId: orgId,
    },
    groups: { organization: orgId },
  });

  return updatedScores;
}

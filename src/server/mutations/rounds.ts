"use server";

import prisma from "@/server/db/db";
import {
  requireAuthContext,
  requireGameInCircle,
  type AuthedOrgContext,
} from "./common";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { getGameCompletion } from "@/lib/gameLogic";
import { getGameById } from "@/server/queries/games";
import { updateGameAsFinished } from "./games";
import { scheduleGameSummary } from "@/server/ai/summary";

async function syncGameCompletionAfterScoreWrite(
  gameId: string,
  userId: string,
  posthog: AuthedOrgContext["posthog"]
) {
  const updatedGame = await getGameById(gameId);
  if (!updatedGame) return;

  const completion = getGameCompletion(updatedGame);

  if (!completion.winnerId) {
    if (updatedGame.isFinished) {
      await prisma.game.update({
        where: { id: gameId },
        data: { isFinished: false, winnerId: null, endedAt: null },
      });

      posthog.capture({
        distinctId: userId,
        event: "game_reopened_after_edit",
        properties: { game_id: gameId },
      });
    }
    return;
  }

  if (completion.gameShouldBeFinalized) {
    await updateGameAsFinished(
      gameId,
      completion.winnerId,
      completion.isGuestWinner
    );
    return;
  }

  if (completion.winnerId !== updatedGame.winnerId) {
    await prisma.game.update({
      where: { id: gameId },
      data: { winnerId: completion.winnerId },
    });

    posthog.capture({
      distinctId: userId,
      event: "game_winner_updated_after_edit",
      properties: { game_id: gameId, new_winner_id: completion.winnerId },
    });
  }

  // Reaching here means the game is finished (no-winner and finalize branches
  // returned earlier). A finished game may have been edited, so refresh the
  // recap — hash-gated, so it's a no-op when the scores are unchanged.
  // Best-effort: a summary failure must never fail the score edit.
  try {
    await scheduleGameSummary(gameId);
  } catch (error) {
    console.error("[insights] failed to schedule game summary", error);
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
  const { user, posthog, orgId } = await requireAuthContext("org");

  const game = await requireGameInCircle(gameId, orgId);

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
      if (existing) {
        await syncGameCompletionAfterScoreWrite(game.id, user.userId, posthog);
        return existing;
      }
    }
    throw error;
  }

  // Batch-insert all scores in a single createMany call to minimise DB roundtrips
  const now = new Date();
  const scoreRows = scores
    .filter((score) => {
      if (!score.userId && !score.guestId) {
        console.error("Score missing both userId and guestId:", score);
        return false;
      }
      return true;
    })
    .map((score) => ({
      roundId: round.id,
      blitzPileRemaining: score.blitzPileRemaining,
      totalCardsPlayed: score.totalCardsPlayed,
      updatedAt: now,
      ...(score.userId ? { userId: score.userId } : { guestId: score.guestId }),
    }));

  if (scoreRows.length > 0) {
    await prisma.score.createMany({ data: scoreRows });
  }

  posthog.capture({ distinctId: user.userId, event: "create_scores" });

  await syncGameCompletionAfterScoreWrite(game.id, user.userId, posthog);

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
  const { user, posthog, orgId } = await requireAuthContext("org");

  await requireGameInCircle(gameId, orgId);

  // Finished games are still editable — if an edit drops all players
  // below the threshold, the game will be reopened (see below).

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

  await syncGameCompletionAfterScoreWrite(gameId, user.userId, posthog);

  return updatedScores;
}

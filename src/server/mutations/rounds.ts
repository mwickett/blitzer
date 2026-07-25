"use server";

import prisma from "@/server/db/db";
import {
  requireAuthContext,
  requireGameScoringAccess,
  assertScoreRoster,
  isUniqueConstraintError,
  type AuthedUserContext,
} from "./common";
import { validateGameRules, ValidationError } from "@/lib/validation/gameRules";
import { getGameCompletion } from "@/lib/gameLogic";
import { getGameById } from "@/server/queries/games";
import { updateGameAsFinished } from "./games";

/**
 * Whether a submission is the same data already stored for a round — i.e. a
 * re-send of the same tap rather than a competing set of scores.
 */
function scoresMatch(
  stored: {
    userId: string | null;
    guestId: string | null;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[],
  submitted: {
    userId?: string;
    guestId?: string;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[],
) {
  if (stored.length !== submitted.length) return false;
  const key = (s: { userId?: string | null; guestId?: string | null }) =>
    s.userId ? `user:${s.userId}` : `guest:${s.guestId}`;
  const storedByPlayer = new Map(stored.map((s) => [key(s), s]));
  return submitted.every((s) => {
    const match = storedByPlayer.get(key(s));
    return (
      !!match &&
      match.blitzPileRemaining === s.blitzPileRemaining &&
      match.totalCardsPlayed === s.totalCardsPlayed
    );
  });
}

async function syncGameCompletionAfterScoreWrite(
  gameId: string,
  userId: string,
  posthog: AuthedUserContext["posthog"],
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
      completion.isGuestWinner,
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
  }[],
) {
  const { user, posthog } = await requireAuthContext("user");
  const game = await requireGameScoringAccess(gameId);

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
  assertScoreRoster(game.players, scores);

  // Create round — the @@unique([gameId, round]) constraint prevents duplicates.
  let round;
  try {
    round = await prisma.round.create({
      data: {
        gameId: game.id,
        round: roundNumber,
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    // The round already exists. That is either the same device submitting
    // twice, or — now that pickup players score from their own devices —
    // somebody else recording this round first. Returning early is right for
    // the double-tap and silently discards real scores in the second case, so
    // the two have to be told apart.
    const existing = await prisma.round.findFirst({
      where: { gameId: game.id, round: roundNumber },
      include: { scores: true },
    });
    if (existing) {
      if (!scoresMatch(existing.scores, scores)) {
        // Somebody else got there first. An ordinary outcome of scoring from
        // several devices, so it comes back as a value — throwing would file
        // it in Sentry as a crash and mask the message in production.
        posthog.capture({
          distinctId: user.userId,
          event: "round_submit_conflict",
          properties: { game_id: game.id, round_number: roundNumber },
        });
        return {
          ok: false as const,
          reason: "round_conflict" as const,
          message: `Round ${roundNumber} was already recorded by another player. Refresh to see the current scores.`,
        };
      }
      await syncGameCompletionAfterScoreWrite(game.id, user.userId, posthog);
      return { ok: true as const, round: existing };
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

  return { ok: true as const, round };
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
  }[],
) {
  const { user, posthog } = await requireAuthContext("user");
  const game = await requireGameScoringAccess(gameId);

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { gameId: true },
  });
  if (!round || round.gameId !== gameId)
    throw new Error("Round not found in this game");

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
  assertScoreRoster(game.players, scores);

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

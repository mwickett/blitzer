import { z } from "zod";
import { type Score, type ScoreValidation } from "./schema";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateGameRules(scores: Score[] | ScoreValidation[]) {
  // Check if at least one player has blitzed
  const atLeastOneBlitzed = scores.some(
    (score) => score.blitzPileRemaining === 0
  );
  if (!atLeastOneBlitzed) {
    throw new ValidationError(
      "At least one player must blitz (have 0 cards remaining)"
    );
  }

  // Check if players who blitzed have played enough cards
  const invalidBlitzScores = scores.some(
    (score) => score.blitzPileRemaining === 0 && score.totalCardsPlayed < 6
  );
  if (invalidBlitzScores) {
    throw new ValidationError("Players who blitz must play at least 6 cards");
  }

  return true;
}

// Helper function to check if a single score represents a valid blitz
export function isValidBlitz(score: Score | ScoreValidation): boolean {
  if (score.blitzPileRemaining === 0) {
    return score.totalCardsPlayed >= 6;
  }
  return true;
}

// Helper function to check if any player has blitzed
export function hasBlitz(scores: Score[] | ScoreValidation[]): boolean {
  return scores.some((score) => score.blitzPileRemaining === 0);
}

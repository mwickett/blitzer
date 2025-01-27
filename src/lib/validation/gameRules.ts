import { z } from "zod";
import { type Score, type ScoreValidation } from "./schema";

// Game constants
export const GAME_RULES = {
  MIN_CARDS_FOR_BLITZ: 4,
  POINTS_TO_WIN: 75,
  BLITZ_PENALTY_MULTIPLIER: 2,
  MAX_BLITZ_PILE: 10,
  MAX_CARDS_PLAYED: 40,
} as const;

// Game error messages
export const ERROR_MESSAGES = {
  NO_BLITZ: "At least one player must blitz (have 0 cards remaining)",
  INVALID_BLITZ: "Players who blitz must play at least 4 cards",
  INVALID_SCORE:
    "Invalid scores: Blitz pile must be 0-10 cards, total cards played must be 0-40",
} as const;

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
    throw new ValidationError(ERROR_MESSAGES.NO_BLITZ);
  }

  // Check if players who blitzed have played enough cards
  const invalidBlitzScores = scores.some(
    (score) =>
      score.blitzPileRemaining === 0 &&
      score.totalCardsPlayed < GAME_RULES.MIN_CARDS_FOR_BLITZ
  );
  if (invalidBlitzScores) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_BLITZ);
  }

  return true;
}

// Helper function to check if a single score represents a valid blitz
export function isValidBlitz(score: Score | ScoreValidation): boolean {
  if (score.blitzPileRemaining === 0) {
    return score.totalCardsPlayed >= GAME_RULES.MIN_CARDS_FOR_BLITZ;
  }
  return true;
}

// Helper function to check if any player has blitzed
export function hasBlitz(scores: Score[] | ScoreValidation[]): boolean {
  return scores.some((score) => score.blitzPileRemaining === 0);
}

// Calculate score for a round
export function calculateRoundScore(score: Score | ScoreValidation): number {
  return (
    -(score.blitzPileRemaining * GAME_RULES.BLITZ_PENALTY_MULTIPLIER) +
    score.totalCardsPlayed
  );
}

// Check if score meets winning threshold
export function isWinningScore(total: number): boolean {
  return total >= GAME_RULES.POINTS_TO_WIN;
}

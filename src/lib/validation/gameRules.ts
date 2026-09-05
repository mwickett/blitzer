import { type ScoreValidation } from "./schema";

// Game constants
export const GAME_RULES = {
  MIN_CARDS_FOR_BLITZ: 4,
  POINTS_TO_WIN: 75,
  BLITZ_PENALTY_MULTIPLIER: 2,
  MAX_BLITZ_PILE: 10,
  MAX_CARDS_PLAYED: 40,
  // Dutch Blitz expansion packs seat eight. Past six the accent palette
  // repeats (see assignColorsToPlayers), which is accepted rather than a
  // reason to cap lower. Applies to every game, pickup or Circle.
  MAX_PLAYERS: 8,
} as const;

// Game error messages
export const ERROR_MESSAGES = {
  NO_BLITZ: "At least one player must blitz (have 0 cards remaining)",
  INVALID_BLITZ: "Players who blitz must play at least 4 cards",
} as const;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateGameRules(scores: ScoreValidation[]) {
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

// Calculate score for a round
export function calculateRoundScore(score: ScoreValidation): number {
  return (
    -(score.blitzPileRemaining * GAME_RULES.BLITZ_PENALTY_MULTIPLIER) +
    score.totalCardsPlayed
  );
}

// Canonical SQL expression for a single-round score. Server queries
// interpolate this with Prisma.raw() instead of re-inlining the formula;
// it is derived from GAME_RULES so the SQL and TS forms cannot drift.
// (Plain string on purpose — this module is also imported client-side.)
export const ROUND_SCORE_SQL = `("totalCardsPlayed" - ("blitzPileRemaining" * ${GAME_RULES.BLITZ_PENALTY_MULTIPLIER}))`;

// Check if score meets winning threshold
export function isWinningScore(total: number, threshold: number = GAME_RULES.POINTS_TO_WIN): boolean {
  return total >= threshold;
}

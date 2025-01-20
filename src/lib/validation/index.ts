import { z } from "zod";
import {
  scoreSchema,
  scoresSchema,
  scoreValidationSchema,
  type Score,
  type Scores,
  type ScoreValidation,
} from "./schema";
import { validateGameRules, ValidationError } from "./gameRules";

export { type Score, type Scores, type ScoreValidation, ValidationError };

/**
 * Validates a complete score entry including all fields and game rules
 * Used primarily on the client side where we have full score objects
 */
export function validateScores(scores: Score[]): asserts scores is Score[] {
  try {
    // First validate the schema
    scoresSchema.parse(scores);
    // Then validate game rules
    validateGameRules(scores);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message);
    }
    throw error;
  }
}

/**
 * Validates just the essential score data needed for game rules
 * Used primarily on the server side where we might not have full score objects
 */
export function validateScoreData(
  scores: ScoreValidation[]
): asserts scores is ScoreValidation[] {
  try {
    // First validate the schema
    z.array(scoreValidationSchema).parse(scores);
    // Then validate game rules
    validateGameRules(scores);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message);
    }
    throw error;
  }
}

// Re-export schemas for cases where just schema validation is needed
export const schemas = {
  score: scoreSchema,
  scores: scoresSchema,
  scoreValidation: scoreValidationSchema,
};

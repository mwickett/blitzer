import { z } from "zod";

// Basic score schema without game-specific rules
export const scoreSchema = z.object({
  userId: z.string(),
  username: z.string(),
  roundNumber: z.number().min(1),
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

// Type for a single score
export type Score = z.infer<typeof scoreSchema>;

// Schema for an array of scores
export const scoresSchema = z.array(scoreSchema);

// Type for an array of scores
export type Scores = z.infer<typeof scoresSchema>;

// Schema for the minimal score data needed for validation
// This is useful for server-side validation where we don't need all fields
export const scoreValidationSchema = z.object({
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
});

export type ScoreValidation = z.infer<typeof scoreValidationSchema>;

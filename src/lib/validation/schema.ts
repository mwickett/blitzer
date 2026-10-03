import { z } from "zod";

// Schema for the minimal score data needed for validation
// This is useful for server-side validation where we don't need all fields
export const scoreValidationSchema = z.object({
  blitzPileRemaining: z.number().int().min(0).max(10),
  totalCardsPlayed: z.number().int().min(0).max(40),
});

export type ScoreValidation = z.infer<typeof scoreValidationSchema>;

/**
 * A stored round score: a card breakdown, or a total typed directly in
 * "Do math" mode, where the breakdown is null.
 */
export interface RoundScoreValues {
  blitzPileRemaining?: number | null;
  totalCardsPlayed?: number | null;
  typedScore?: number | null;
}

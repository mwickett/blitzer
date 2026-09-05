import { z } from "zod";

// Schema for the minimal score data needed for validation
// This is useful for server-side validation where we don't need all fields
export const scoreValidationSchema = z.object({
  blitzPileRemaining: z.number().int().min(0).max(10),
  totalCardsPlayed: z.number().int().min(0).max(40),
});

export type ScoreValidation = z.infer<typeof scoreValidationSchema>;

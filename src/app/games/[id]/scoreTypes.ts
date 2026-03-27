import { z } from "zod";

export interface RoundScoreData {
  userId?: string;
  guestId?: string;
  blitzPileRemaining: number;
  totalCardsPlayed: number;
}

export const playerScoreSchema = z.object({
  id: z.string(),
  username: z.string(),
  isGuest: z.boolean().default(false),
  roundNumber: z.number().min(1),
  blitzPileRemaining: z.number().min(0).max(10),
  totalCardsPlayed: z.number().min(0).max(40),
  touched: z.object({
    totalCardsPlayed: z.boolean(),
  }),
});

export const scoresSchema = z.array(playerScoreSchema);

export type EditingScore = z.infer<typeof playerScoreSchema>;

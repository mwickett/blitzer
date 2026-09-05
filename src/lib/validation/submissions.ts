import { z } from "zod";
import { validateGameRules, ValidationError, GAME_RULES } from "./gameRules";
import { scoreValidationSchema } from "./schema";

export const winThresholdSchema = z.number().int().min(25).max(200).default(75);
export const guestNameSchema = z.string().trim().min(1).max(50);
export const pickupGameSchema = z.object({
  winThreshold: winThresholdSchema,
  guestNames: z
    .array(guestNameSchema)
    .max(GAME_RULES.MAX_PLAYERS - 1)
    .default([]),
});

const participantScoreSchema = scoreValidationSchema
  .extend({
    userId: z.string().min(1).optional(),
    guestId: z.string().min(1).optional(),
  })
  .refine((score) => Boolean(score.userId) !== Boolean(score.guestId), {
    message: "Each score must identify exactly one player or guest.",
  });

export type SubmittedScore = z.infer<typeof participantScoreSchema>;
export const submittedScoresSchema = z
  .array(participantScoreSchema)
  .min(2)
  .max(GAME_RULES.MAX_PLAYERS)
  .superRefine((scores, ctx) => {
    const keys = scores.map((score) =>
      score.userId ? `user:${score.userId}` : `guest:${score.guestId}`,
    );
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each player must have exactly one score.",
      });
    }
    try {
      validateGameRules(scores);
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error.message });
    }
  });

const playerSchema = z
  .object({
    id: z.string().min(1),
    username: z.string().optional(),
    isGuest: z.boolean().optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .superRefine((player, ctx) => {
    if (player.isGuest && !guestNameSchema.safeParse(player.username).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Guest names must contain 1–50 characters.",
      });
    }
  });

export const circleGameSchema = z.object({
  users: z
    .array(playerSchema)
    .min(2, "A game needs at least 2 players.")
    .max(
      GAME_RULES.MAX_PLAYERS,
      `A game seats up to ${GAME_RULES.MAX_PLAYERS} players.`,
    )
    .refine(
      (players) =>
        new Set(players.map((player) => player.id)).size === players.length,
      "Each player can only be included once.",
    ),
  winThreshold: winThresholdSchema,
});

export const scoreWriteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    gameId: z.string().min(1),
    roundNumber: z.number().int().positive(),
    scores: submittedScoresSchema,
  }),
  z.object({
    kind: z.literal("edit"),
    gameId: z.string().min(1),
    roundId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
    scores: submittedScoresSchema,
  }),
]);

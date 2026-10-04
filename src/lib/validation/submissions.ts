import { z } from "zod";
import {
  GAME_RULES,
  hasBreakdown,
  validateGameRules,
  ValidationError,
} from "./gameRules";
import { scoreValidationSchema } from "./schema";
import { DECK_IDS } from "@/lib/scoring/decks";

export const winThresholdSchema = z.number().int().min(25).max(200).default(75);
export const deckSchema = z.enum(DECK_IDS);
export const guestNameSchema = z.string().trim().min(1).max(50);
export const pickupGameSchema = z.object({
  winThreshold: winThresholdSchema,
  guestNames: z
    .array(guestNameSchema)
    .max(GAME_RULES.MAX_PLAYERS - 1)
    .default([]),
});

const breakdownSchema = scoreValidationSchema.shape;
const typedScoreSchema = z
  .number()
  .int()
  .min(GAME_RULES.MIN_ROUND_SCORE)
  .max(GAME_RULES.MAX_ROUND_SCORE);

// A score is a card breakdown or, in "Do math" mode, a typed round total.
const participantScoreSchema = z
  .object({
    userId: z.string().min(1).optional(),
    guestId: z.string().min(1).optional(),
    blitzPileRemaining: breakdownSchema.blitzPileRemaining.nullish(),
    totalCardsPlayed: breakdownSchema.totalCardsPlayed.nullish(),
    typedScore: typedScoreSchema.nullish(),
  })
  .refine((score) => Boolean(score.userId) !== Boolean(score.guestId), {
    message: "Each score must identify exactly one player or guest.",
  })
  .refine(
    (score) => {
      const hasBlitz = score.blitzPileRemaining != null;
      const hasCards = score.totalCardsPlayed != null;
      return score.typedScore != null
        ? !hasCards && !hasBlitz
        : hasCards && hasBlitz;
    },
    {
      message:
        "Each score needs Blitz left and cards played, or a round total.",
    },
  );

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
    const breakdowns = scores.filter(hasBreakdown);
    // Typed totals carry no Blitz pile, so the blitz rules cannot apply.
    if (breakdowns.length === 0) return;
    if (breakdowns.length !== scores.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter every player's round the same way.",
      });
      return;
    }
    try {
      validateGameRules(breakdowns);
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
    // undefined falls back to the player's saved deck; null means no deck.
    deck: deckSchema.nullable().optional(),
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

// Shape check only; normalizeDashboardLayout drops unknown card ids.
const dashboardCardIdsSchema = z.array(z.string().max(40)).max(50);
export const dashboardLayoutSchema = z
  .object({ order: dashboardCardIdsSchema, hidden: dashboardCardIdsSchema })
  .nullable();

/** Personal story style is a short note, not a second system prompt. */
export const STORY_PROMPT_MAX_LENGTH = 280;
// Blank clears the prompt.
export const storyPromptSchema = z
  .string()
  .trim()
  .max(STORY_PROMPT_MAX_LENGTH)
  .transform((prompt) => prompt || null);

export const scoreEntryModeSchema = z.enum(["CARDS", "TOTAL"]);

export const GAME_NOTE_MAX_LENGTH = 280;
// Blank notes clear the stored note.
export const gameNoteSchema = z
  .string()
  .trim()
  .max(
    GAME_NOTE_MAX_LENGTH,
    `Keep the note to ${GAME_NOTE_MAX_LENGTH} characters.`,
  )
  .transform((note) => note || null);

export const GAME_TAG_MAX_LENGTH = 24;
// Blank tags clear the stored tag.
export const gameTagSchema = z
  .string()
  .trim()
  .max(
    GAME_TAG_MAX_LENGTH,
    `Keep the tag to ${GAME_TAG_MAX_LENGTH} characters.`,
  )
  .transform((tag) => tag.replace(/\s+/g, " ") || null);

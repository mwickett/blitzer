import { describe, it, expect } from "@jest/globals";
import {
  validateScores,
  validateScoreData,
  ValidationError,
} from "../validation";
import { type Score, type ScoreValidation } from "../validation";
import { isValidBlitz, hasBlitz } from "../validation/gameRules";

// Test data helpers
const createValidScore = (
  blitzPileRemaining: number,
  totalCardsPlayed: number
) => ({
  userId: "test-user-1",
  username: "Test User",
  roundNumber: 1,
  blitzPileRemaining,
  totalCardsPlayed,
  touched: {
    totalCardsPlayed: true,
  },
});

const createValidScores = (
  scores: { blitzPile: number; cardsPlayed: number }[]
) =>
  scores.map((score, index) =>
    createValidScore(score.blitzPile, score.cardsPlayed)
  );

describe("Score Validation", () => {
  describe("Basic Schema Validation", () => {
    it("should validate valid score ranges", () => {
      const validScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 10 }, // Valid blitz
        { blitzPile: 5, cardsPlayed: 20 }, // Mid-game score
      ]);

      expect(() => validateScores(validScores)).not.toThrow();
    });

    it("should reject scores with invalid blitz pile values", () => {
      expect(() => {
        const scores = createValidScores([
          { blitzPile: -1, cardsPlayed: 10 }, // Negative blitz pile
        ]);
        validateScores(scores);
      }).toThrow();

      expect(() => {
        const scores = createValidScores([
          { blitzPile: 11, cardsPlayed: 10 }, // Too many blitz cards
        ]);
        validateScores(scores);
      }).toThrow();
    });

    it("should reject scores with invalid cards played values", () => {
      expect(() => {
        const scores = createValidScores([
          { blitzPile: 5, cardsPlayed: -1 }, // Negative cards played
        ]);
        validateScores(scores);
      }).toThrow();

      expect(() => {
        const scores = createValidScores([
          { blitzPile: 5, cardsPlayed: 41 }, // Too many cards played
        ]);
        validateScores(scores);
      }).toThrow();
    });
  });

  describe("Game Rules Validation", () => {
    it("should require at least one player to blitz", () => {
      const noBlitzScores = createValidScores([
        { blitzPile: 1, cardsPlayed: 10 },
        { blitzPile: 2, cardsPlayed: 15 },
      ]);

      expect(() => validateScores(noBlitzScores)).toThrow(
        "At least one player must blitz"
      );
    });

    it("should require blitzed players to play minimum cards", () => {
      const invalidBlitzScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 5 }, // Invalid: Blitzed but not enough cards
        { blitzPile: 5, cardsPlayed: 10 }, // Valid non-blitz score
      ]);

      expect(() => validateScores(invalidBlitzScores)).toThrow(
        "Players who blitz must play at least 6 cards"
      );
    });

    it("should allow valid game scenarios", () => {
      const validGameScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 15 }, // Valid blitz with enough cards
        { blitzPile: 5, cardsPlayed: 10 }, // Valid non-blitz score
      ]);

      expect(() => validateScores(validGameScores)).not.toThrow();
    });

    it("should handle edge cases", () => {
      const edgeCaseScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 6 }, // Minimum valid blitz
        { blitzPile: 0, cardsPlayed: 40 }, // Maximum cards played
        { blitzPile: 10, cardsPlayed: 0 }, // No cards played
      ]);

      expect(() => validateScores(edgeCaseScores)).not.toThrow();
    });
  });

  describe("Helper Functions", () => {
    it("should correctly identify valid blitz scores", () => {
      expect(isValidBlitz({ blitzPileRemaining: 0, totalCardsPlayed: 6 })).toBe(
        true
      );
      expect(isValidBlitz({ blitzPileRemaining: 0, totalCardsPlayed: 5 })).toBe(
        false
      );
      expect(isValidBlitz({ blitzPileRemaining: 5, totalCardsPlayed: 0 })).toBe(
        true
      );
    });

    it("should correctly identify if round has blitz", () => {
      const scoresWithBlitz = [
        { blitzPileRemaining: 0, totalCardsPlayed: 10 },
        { blitzPileRemaining: 5, totalCardsPlayed: 5 },
      ];
      const scoresWithoutBlitz = [
        { blitzPileRemaining: 1, totalCardsPlayed: 10 },
        { blitzPileRemaining: 5, totalCardsPlayed: 5 },
      ];

      expect(hasBlitz(scoresWithBlitz)).toBe(true);
      expect(hasBlitz(scoresWithoutBlitz)).toBe(false);
    });
  });

  describe("Server-side Validation", () => {
    it("should validate minimal score data", () => {
      const validScores = [
        { blitzPileRemaining: 0, totalCardsPlayed: 10 },
        { blitzPileRemaining: 5, totalCardsPlayed: 5 },
      ];
      expect(() => validateScoreData(validScores)).not.toThrow();
    });

    it("should reject invalid minimal score data", () => {
      const invalidScores = [
        { blitzPileRemaining: 0, totalCardsPlayed: 5 }, // Not enough cards for blitz
        { blitzPileRemaining: 5, totalCardsPlayed: 5 },
      ];
      expect(() => validateScoreData(invalidScores)).toThrow();
    });

    it("should handle non-Zod validation errors", () => {
      // Create a test-specific error for validation
      class TestValidationError extends Error {
        constructor() {
          super("Test validation error");
        }
      }

      const scores = [
        { blitzPileRemaining: 0, totalCardsPlayed: 5 }, // This will trigger game rules validation error
      ];

      expect(() => validateScoreData(scores)).toThrow(
        "Players who blitz must play"
      );
    });
  });

  describe("Schema Exports", () => {
    it("should export valid schemas", () => {
      const { schemas } = require("../validation");
      expect(schemas.score).toBeDefined();
      expect(schemas.scores).toBeDefined();
      expect(schemas.scoreValidation).toBeDefined();

      // Verify schemas work
      const validScore = {
        userId: "test",
        username: "Test User",
        roundNumber: 1,
        blitzPileRemaining: 0,
        totalCardsPlayed: 10,
        touched: { totalCardsPlayed: true },
      };

      expect(() => schemas.score.parse(validScore)).not.toThrow();
      expect(() => schemas.scores.parse([validScore])).not.toThrow();
      expect(() =>
        schemas.scoreValidation.parse({
          blitzPileRemaining: 0,
          totalCardsPlayed: 10,
        })
      ).not.toThrow();
    });
  });
});

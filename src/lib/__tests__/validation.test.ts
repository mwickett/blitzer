import { describe, it, expect } from "@jest/globals";
import {
  validateGameRules,
  ValidationError,
  isValidBlitz,
  hasBlitz,
  calculateRoundScore,
  isWinningScore,
  GAME_RULES,
} from "../validation/gameRules";
import { type Score, type ScoreValidation } from "../validation/schema";

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

describe("Game Rules", () => {
  describe("Score Validation", () => {
    it("should require at least one player to blitz", () => {
      const noBlitzScores = createValidScores([
        { blitzPile: 1, cardsPlayed: 10 },
        { blitzPile: 2, cardsPlayed: 15 },
      ]);

      expect(() => validateGameRules(noBlitzScores)).toThrow(
        "At least one player must blitz"
      );
    });

    it("should require blitzed players to play minimum cards", () => {
      const invalidBlitzScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 3 }, // Invalid: Blitzed but not enough cards
        { blitzPile: 5, cardsPlayed: 10 }, // Valid non-blitz score
      ]);

      expect(() => validateGameRules(invalidBlitzScores)).toThrow(
        "Players who blitz must play at least 4 cards"
      );
    });

    it("should allow valid game scenarios", () => {
      const validGameScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 15 }, // Valid blitz with enough cards
        { blitzPile: 5, cardsPlayed: 10 }, // Valid non-blitz score
      ]);

      expect(() => validateGameRules(validGameScores)).not.toThrow();
    });

    it("should handle edge cases", () => {
      const edgeCaseScores = createValidScores([
        { blitzPile: 0, cardsPlayed: 4 }, // Minimum valid blitz
        { blitzPile: 0, cardsPlayed: 40 }, // Maximum cards played
        { blitzPile: 10, cardsPlayed: 0 }, // No cards played
      ]);

      expect(() => validateGameRules(edgeCaseScores)).not.toThrow();
    });
  });

  describe("Score Calculations", () => {
    it("should calculate round scores correctly", () => {
      // No penalty (blitzed)
      expect(
        calculateRoundScore({ blitzPileRemaining: 0, totalCardsPlayed: 10 })
      ).toBe(10);

      // With penalty
      expect(
        calculateRoundScore({ blitzPileRemaining: 5, totalCardsPlayed: 15 })
      ).toBe(5); // 15 - (5 * 2)

      // Edge case - no cards played
      expect(
        calculateRoundScore({ blitzPileRemaining: 10, totalCardsPlayed: 0 })
      ).toBe(-20);
    });

    it("should identify winning scores", () => {
      expect(isWinningScore(GAME_RULES.POINTS_TO_WIN - 1)).toBe(false);
      expect(isWinningScore(GAME_RULES.POINTS_TO_WIN)).toBe(true);
      expect(isWinningScore(GAME_RULES.POINTS_TO_WIN + 1)).toBe(true);
    });

    it("should identify valid blitz scores", () => {
      expect(isValidBlitz({ blitzPileRemaining: 0, totalCardsPlayed: 4 })).toBe(
        true
      );
      expect(isValidBlitz({ blitzPileRemaining: 0, totalCardsPlayed: 3 })).toBe(
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
});

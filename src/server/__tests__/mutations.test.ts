import {
  createGame,
  createRoundForGame,
  updateGameAsFinished,
  updateRoundScores,
  createFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cloneGame,
} from "../mutations";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import { redirect } from "next/navigation";

// Mock dependencies
jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    game: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    round: {
      create: jest.fn(),
    },
    score: {
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    friend: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    friendRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => Promise.all(callback)),
  },
}));

// Mock types
type AuthResult = { userId: string | null };
type AuthFn = () => Promise<AuthResult>;

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn() as jest.MockedFunction<AuthFn>,
}));

// Create a mock capture function we can make assertions on
const mockCapture = jest.fn();
jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({
    capture: mockCapture,
  }),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Game Mutations", () => {
  const mockUserId = "test-user-id";
  const mockGameId = "test-game-id";
  const mockTargetUserId = "target-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: mockUserId });
  });

  describe("createRoundForGame", () => {
    const validScores = [
      {
        userId: "player1",
        blitzPileRemaining: 0, // Blitzed
        totalCardsPlayed: 10, // More than minimum required
      },
      {
        userId: "player2",
        blitzPileRemaining: 5,
        totalCardsPlayed: 20,
      },
    ];

    it("should create a new round with scores", async () => {
      const mockGame = { id: mockGameId };
      const mockRound = { id: "round-1", scores: validScores };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.create as jest.Mock).mockResolvedValue(mockRound);

      const result = await createRoundForGame(mockGameId, 1, validScores);

      expect(prisma.round.create).toHaveBeenCalledWith({
        data: {
          gameId: mockGameId,
          round: 1,
          scores: {
            create: validScores.map((score) => ({
              blitzPileRemaining: score.blitzPileRemaining,
              totalCardsPlayed: score.totalCardsPlayed,
              updatedAt: expect.any(Date),
              user: {
                connect: { id: score.userId },
              },
            })),
          },
        },
      });

      expect(result).toBe(mockRound);
    });

    it("should throw error if validation fails", async () => {
      const mockGame = { id: mockGameId };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const invalidScores = [
        {
          userId: "player1",
          blitzPileRemaining: 5, // No blitz
          totalCardsPlayed: 20,
        },
      ];

      await expect(
        createRoundForGame(mockGameId, 1, invalidScores)
      ).rejects.toThrow("At least one player must blitz");

      // Verify PostHog capture was called with validation error
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: mockUserId,
        event: "validation_error",
        properties: {
          error: "At least one player must blitz (have 0 cards remaining)",
          scores: invalidScores,
          gameId: mockGameId,
          roundNumber: 1,
          type: "game_rules",
        },
      });
    });

    it("should throw error if database operation fails", async () => {
      const mockGame = { id: mockGameId };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        createRoundForGame(mockGameId, 1, validScores)
      ).rejects.toThrow("Database error");
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        createRoundForGame(mockGameId, 1, validScores)
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createRoundForGame(mockGameId, 1, validScores)
      ).rejects.toThrow("Game not found");
    });
  });

  describe("updateRoundScores", () => {
    const mockRoundId = "round-1";
    const validScores = [
      {
        userId: "player1",
        blitzPileRemaining: 0, // Blitzed
        totalCardsPlayed: 10, // More than minimum required
      },
      {
        userId: "player2",
        blitzPileRemaining: 5,
        totalCardsPlayed: 20,
      },
    ];

    it("should update scores for a round", async () => {
      const mockGame = { id: mockGameId, isFinished: false };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 1 }]);

      const result = await updateRoundScores(
        mockGameId,
        mockRoundId,
        validScores
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([{ count: 1 }]);
    });

    it("should throw error if validation fails", async () => {
      const mockGame = { id: mockGameId, isFinished: false };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const invalidScores = [
        {
          userId: "player1",
          blitzPileRemaining: 5, // No blitz
          totalCardsPlayed: 20,
        },
      ];

      await expect(
        updateRoundScores(mockGameId, mockRoundId, invalidScores)
      ).rejects.toThrow("At least one player must blitz");

      // Verify PostHog capture was called with validation error
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: mockUserId,
        event: "validation_error",
        properties: {
          error: "At least one player must blitz (have 0 cards remaining)",
          scores: invalidScores,
          gameId: mockGameId,
          roundId: mockRoundId,
          type: "game_rules",
        },
      });
    });

    it("should throw error if game is finished", async () => {
      const mockGame = { id: mockGameId, isFinished: true };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, validScores)
      ).rejects.toThrow("Cannot update scores for a finished game");
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, validScores)
      ).rejects.toThrow("Game not found");
    });
  });
});

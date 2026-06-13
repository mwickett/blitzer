import {
  getGameById,
  getGames,
  getLegacyGames,
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
  getLongestAndShortestGamesByRounds,
} from "../queries";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";

// Mock dependencies
jest.mock("../db/db", () => {
  const mockPrisma = {
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    score: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    round: {
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Mock Prisma.sql template literal tag and Prisma.raw
jest.mock("@/generated/prisma/client", () => ({
  Prisma: {
    sql: jest.fn((strings, ...values) => ({
      strings,
      values,
    })),
    raw: jest.fn((value) => ({ raw: value })),
  },
}));

// Mock types
type AuthResult = { userId: string | null };
type AuthFn = () => Promise<AuthResult>;

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn() as jest.MockedFunction<AuthFn>,
}));

jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({
    capture: jest.fn(),
  }),
}));

describe("Queries", () => {
  const mockUserId = "test-user-id";
  const mockClerkUserId = "clerk-test-user-id";
  const mockOrgId = "org_test123";

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: mockClerkUserId,
      orgId: mockOrgId,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserId,
    });
  });

  describe("getGameById", () => {
    it("should return game with players and rounds", async () => {
      const mockGame = {
        id: "game-1",
        players: [
          {
            user: {
              id: "user-1",
              username: "Player 1",
            },
          },
        ],
        rounds: [
          {
            id: "round-1",
            scores: [
              {
                userId: "user-1",
                blitzPileRemaining: 5,
                totalCardsPlayed: 20,
              },
            ],
          },
        ],
      };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const result = await getGameById("game-1");

      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: "game-1" },
        include: {
          players: {
            include: {
              user: true,
              guestUser: true,
            },
          },
          rounds: {
            include: {
              scores: true,
            },
          },
        },
      });

      expect(result).toEqual(mockGame);
    });

    it("should return null if game not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await getGameById("non-existent-game");
      expect(result).toBeNull();
    });
  });

  describe("getGames", () => {
    it("should return games for the active circle", async () => {
      const mockGames = [
        {
          id: "game-1",
          createdAt: new Date(),
          organizationId: mockOrgId,
          players: [{ user: { clerk_user_id: mockClerkUserId } }],
          rounds: [],
        },
      ];

      (prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames);

      const result = await getGames();

      expect(prisma.game.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
        },
        include: {
          players: {
            include: {
              user: true,
              guestUser: true,
            },
          },
          rounds: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      expect(result).toEqual(mockGames);
    });

    it("should throw error if user not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: null,
        orgId: null,
      });
      await expect(getGames()).rejects.toThrow("Unauthorized");
    });

    it("should throw error if no active circle", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
        orgId: null,
      });
      await expect(getGames()).rejects.toThrow("No active circle");
    });
  });

  describe("Stats Queries", () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(getPlayerBattingAverage()).rejects.toThrow("User not found");
    });

    describe("getPlayerBattingAverage", () => {
      it("should calculate batting average correctly", async () => {
        (prisma.score.count as jest.Mock)
          .mockResolvedValueOnce(10) // totalHandsPlayed
          .mockResolvedValueOnce(4); // totalHandsWon

        const result = await getPlayerBattingAverage();

        expect(result).toEqual({
          totalHandsPlayed: 10,
          totalHandsWon: 4,
          battingAverage: "0.400",
        });
      });

      it("should handle zero hands played", async () => {
        (prisma.score.count as jest.Mock)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0);

        const result = await getPlayerBattingAverage();

        expect(result).toEqual({
          totalHandsPlayed: 0,
          totalHandsWon: 0,
          battingAverage: "0.000",
        });
      });
    });

    describe("getHighestAndLowestScore", () => {
      it("should fetch highest and lowest with one LIMIT 1 query each", async () => {
        (prisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([
            { score: 30, totalCardsPlayed: 40, blitzPileRemaining: 5 },
          ])
          .mockResolvedValueOnce([
            { score: 10, totalCardsPlayed: 20, blitzPileRemaining: 5 },
          ]);

        const result = await getHighestAndLowestScore();

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          highest: {
            score: 30,
            totalCardsPlayed: 40,
            blitzPileRemaining: 5,
          },
          lowest: {
            score: 10,
            totalCardsPlayed: 20,
            blitzPileRemaining: 5,
          },
        });
      });

      it("should report lowest as null when it equals the highest", async () => {
        const mockScore = {
          score: 30,
          totalCardsPlayed: 40,
          blitzPileRemaining: 5,
        };
        (prisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([mockScore])
          .mockResolvedValueOnce([mockScore]);

        const result = await getHighestAndLowestScore();

        expect(result).toEqual({
          highest: {
            score: 30,
            totalCardsPlayed: 40,
            blitzPileRemaining: 5,
          },
          lowest: null,
        });
      });

      it("should handle no scores", async () => {
        (prisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await getHighestAndLowestScore();

        expect(result).toEqual({
          highest: null,
          lowest: null,
        });
      });
    });

    describe("getLongestAndShortestGamesByRounds", () => {
      it("should aggregate round counts in the database, not JS", async () => {
        (prisma.round.groupBy as jest.Mock)
          .mockResolvedValueOnce([{ gameId: "game-long", _count: { _all: 9 } }])
          .mockResolvedValueOnce([
            { gameId: "game-short", _count: { _all: 2 } },
          ]);

        const result = await getLongestAndShortestGamesByRounds();

        expect(result).toEqual({
          longest: { id: "game-long", roundCount: 9 },
          shortest: { id: "game-short", roundCount: 2 },
        });
        // Only the user's finished games count
        expect(prisma.round.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              game: {
                isFinished: true,
                players: { some: { userId: mockUserId } },
              },
            },
          })
        );
      });

      it("should return nulls when the user has no finished games with rounds", async () => {
        (prisma.round.groupBy as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await getLongestAndShortestGamesByRounds();

        expect(result).toEqual({ longest: null, shortest: null });
      });
    });

    describe("getCumulativeScore", () => {
      it("should calculate cumulative score correctly", async () => {
        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: 100,
            blitzPileRemaining: 20,
          },
        });

        const result = await getCumulativeScore();

        // 100 - (20 * 2) = 60
        expect(result).toBe(60);
      });

      it("should return 0 when either totalCardsPlayed or blitzPileRemaining is null", async () => {
        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: 100,
            blitzPileRemaining: null,
          },
        });

        let result = await getCumulativeScore();
        expect(result).toBe(0);

        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: null,
            blitzPileRemaining: 20,
          },
        });

        result = await getCumulativeScore();
        expect(result).toBe(0);
      });

      it("should handle zero values correctly", async () => {
        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: 0,
            blitzPileRemaining: 20,
          },
        });

        let result = await getCumulativeScore();
        expect(result).toBe(-40);

        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: 100,
            blitzPileRemaining: 0,
          },
        });

        result = await getCumulativeScore();
        expect(result).toBe(100);
      });

      it("should return 0 for no scores", async () => {
        (prisma.score.aggregate as jest.Mock).mockResolvedValue({
          _sum: {
            totalCardsPlayed: null,
            blitzPileRemaining: null,
          },
        });

        const result = await getCumulativeScore();

        expect(result).toBe(0);
      });
    });
  });
});

import {
  getGameById,
  getGames,
  getPlayerBattingAverage,
  getHighestAndLowestScore,
  getCumulativeScore,
} from "../queries";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

// Mock dependencies
jest.mock("../db/db", () => {
  const mockPrisma = {
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    score: {
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

jest.mock("@prisma/client", () => ({
  Prisma: {
    sql: jest.fn((strings, ...values) => ({
      strings,
      values,
    })),
  },
}));

type AuthResult = { userId: string | null; orgId?: string | null };
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

describe("Queries (Org Scoped)", () => {
  const mockUserId = "test-user-id";
  const mockClerkUserId = "clerk-test-user-id";
  const mockOrgId = "org_123";

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
    it("should return game within active org", async () => {
      const mockGame = {
        id: "game-1",
        organizationId: mockOrgId,
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

      (prisma.game.findFirst as jest.Mock).mockResolvedValue(mockGame);

      const result = await getGameById("game-1");

      expect(prisma.game.findFirst).toHaveBeenCalledWith({
        where: {
          id: "game-1",
          organizationId: mockOrgId,
          players: {
            some: {
              user: {
                clerk_user_id: mockClerkUserId,
              },
            },
          },
        },
        include: {
          players: {
            include: {
              user: true,
              guestUser: true,
            },
          },
          rounds: {
            include: {
              scores: {
                include: {
                  user: true,
                  guestUser: true,
                },
              },
            },
          },
        },
      });

      expect(result).toEqual(mockGame);
    });

    it("should return null if game not found", async () => {
      (prisma.game.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await getGameById("non-existent-game");
      expect(result).toBeNull();
    });
  });

  describe("getGames", () => {
    it("should return games for authenticated user in active org", async () => {
      const mockGames = [
        {
          id: "game-1",
          organizationId: mockOrgId,
          createdAt: new Date(),
          players: [{ user: { clerk_user_id: mockClerkUserId } }],
          rounds: [],
        },
      ];

      (prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames);

      const result = await getGames();

      expect(prisma.game.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          players: {
            some: {
              user: {
                clerk_user_id: mockClerkUserId,
              },
            },
          },
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
      await expect(getGames()).rejects.toThrow(
        "No active organization selected"
      );
    });
  });

  describe("Stats Queries", () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
        orgId: mockOrgId,
      });
    });

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

    describe("getHighestAndLowestScore", () => {
      it("should return highest and lowest scores", async () => {
        const mockScores = [
          { score: 30, totalCardsPlayed: 40, blitzPileRemaining: 5 },
          { score: 10, totalCardsPlayed: 20, blitzPileRemaining: 5 },
        ];

        (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockScores);

        const result = await getHighestAndLowestScore();

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
        expect(result).toBe(60);
      });
    });
  });
});

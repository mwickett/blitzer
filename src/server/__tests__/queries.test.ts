import {
  getGameById,
  getGames,
  getLegacyGames,
} from "../queries/games";
import {
  getDashboardStats,
  getHighestAndLowestScoreForUser,
  getLongestAndShortestGamesByRoundsForUser,
} from "../queries/stats";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";

// Mock dependencies
jest.mock("../db/db", () => {
  const mockPrisma = {
    game: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    guestUser: { findMany: jest.fn() },
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
    (prisma.game.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.game.count as jest.Mock).mockResolvedValue(0);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.guestUser.findMany as jest.Mock).mockResolvedValue([]);
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
            orderBy: {
              round: "asc",
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

  describe("game lists", () => {
    it("scopes a bounded display query to the active circle and caller pickup games", async () => {
      const result = await getGames();
      expect(prisma.game.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { kind: "CIRCLE", organizationId: mockOrgId },
                  {
                    kind: "PICKUP",
                    players: {
                      some: { user: { clerk_user_id: mockClerkUserId } },
                    },
                  },
                ],
              },
              {},
            ],
          },
          take: 21,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: expect.objectContaining({
            _count: { select: { rounds: true } },
          }),
        }),
      );
      const args = (prisma.game.findMany as jest.Mock).mock.calls[0][0];
      expect(args.include).toBeUndefined();
      expect(args.select.players.select.user).toEqual({
        select: { username: true },
      });
      expect(result.games).toEqual([]);
    });

    it("rejects unauthenticated list and legacy requests", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: null,
        orgId: null,
      });
      await expect(getGames()).rejects.toThrow("Unauthorized");
      await expect(getLegacyGames()).rejects.toThrow("Unauthorized");
      expect(prisma.game.findMany).not.toHaveBeenCalled();
    });

    it("still includes participant pickup games without an active circle", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
        orgId: null,
      });
      await getGames();
      expect(
        (prisma.game.findMany as jest.Mock).mock.calls[0][0].where.AND[0],
      ).toEqual({
        OR: [
          {
            kind: "PICKUP",
            players: { some: { user: { clerk_user_id: mockClerkUserId } } },
          },
        ],
      });
    });

    it("keeps legacy games restricted to the authenticated participant", async () => {
      await getLegacyGames();
      expect(
        (prisma.game.findMany as jest.Mock).mock.calls[0][0].where.AND[0],
      ).toEqual({
        kind: "LEGACY",
        players: { some: { user: { clerk_user_id: mockClerkUserId } } },
      });
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
      await expect(getDashboardStats()).rejects.toThrow("User not found");
    });

    describe("getHighestAndLowestScoreForUser", () => {
      it("should fetch highest and lowest with one LIMIT 1 query each", async () => {
        (prisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([
            { score: 30, totalCardsPlayed: 40, blitzPileRemaining: 5 },
          ])
          .mockResolvedValueOnce([
            { score: 10, totalCardsPlayed: 20, blitzPileRemaining: 5 },
          ]);

        const result = await getHighestAndLowestScoreForUser(mockUserId);

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

        const result = await getHighestAndLowestScoreForUser(mockUserId);

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

        const result = await getHighestAndLowestScoreForUser(mockUserId);

        expect(result).toEqual({
          highest: null,
          lowest: null,
        });
      });
    });

    describe("getLongestAndShortestGamesByRoundsForUser", () => {
      it("should aggregate round counts in the database, not JS", async () => {
        (prisma.round.groupBy as jest.Mock)
          .mockResolvedValueOnce([{ gameId: "game-long", _count: { _all: 9 } }])
          .mockResolvedValueOnce([
            { gameId: "game-short", _count: { _all: 2 } },
          ]);

        const result = await getLongestAndShortestGamesByRoundsForUser(mockUserId);

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
          }),
        );
      });

      it("should return nulls when the user has no finished games with rounds", async () => {
        (prisma.round.groupBy as jest.Mock)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await getLongestAndShortestGamesByRoundsForUser(mockUserId);

        expect(result).toEqual({ longest: null, shortest: null });
      });
    });

    describe("getDashboardStats", () => {
      it("should fetch dashboard stats through the shared helper", async () => {
        (prisma.$queryRaw as jest.Mock)
          .mockResolvedValueOnce([
            { totalRounds: 10, totalBlitzes: 4, cumulativeScore: 60 },
          ])
          .mockResolvedValueOnce([
            { score: 30, totalCardsPlayed: 40, blitzPileRemaining: 5 },
          ])
          .mockResolvedValueOnce([
            { score: 10, totalCardsPlayed: 20, blitzPileRemaining: 5 },
          ]);
        (prisma.round.groupBy as jest.Mock)
          .mockResolvedValueOnce([{ gameId: "game-long", _count: { _all: 9 } }])
          .mockResolvedValueOnce([
            { gameId: "game-short", _count: { _all: 2 } },
          ]);

        const result = await getDashboardStats();

        expect(result).toEqual({
          battingAverage: {
            totalHandsPlayed: 10,
            totalHandsWon: 4,
            battingAverage: "0.400",
          },
          scoreExtremes: {
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
          },
          cumulativeScore: 60,
          gameRoundExtremes: {
            longest: { id: "game-long", roundCount: 9 },
            shortest: { id: "game-short", roundCount: 2 },
          },
        });
      });
    });
  });
});

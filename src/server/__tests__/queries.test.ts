import {
  getGameById,
  getGames,
  getFilteredUsers,
  getFriends,
  getFriendsForNewGame,
  getIncomingFriendRequests,
  getOutgoingPendingFriendRequests,
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
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    friendRequest: {
      findMany: jest.fn(),
    },
    friend: {
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

// Mock Prisma.sql template literal tag
jest.mock("@prisma/client", () => ({
  Prisma: {
    sql: jest.fn((strings, ...values) => ({
      strings,
      values,
    })),
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

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: mockClerkUserId,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: mockUserId,
    });
  });

  describe("getGameById", () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });
    });

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
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await getGameById("non-existent-game");
      expect(result).toBeNull();
    });
  });

  describe("getGames", () => {
    it("should return games for authenticated user", async () => {
      const mockGames = [
        {
          id: "game-1",
          createdAt: new Date(),
          players: [{ user: { clerk_user_id: mockClerkUserId } }],
          rounds: [],
        },
      ];

      (prisma.game.findMany as jest.Mock).mockResolvedValue(mockGames);

      const result = await getGames();

      expect(prisma.game.findMany).toHaveBeenCalledWith({
        where: {
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
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
      await expect(getGames()).rejects.toThrow("Unauthorized");
    });
  });

  describe("getFriends", () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(getFriends()).rejects.toThrow("User not found");
    });

    it("should return mapped friends list", async () => {
      const mockFriends = [
        {
          user1Id: mockUserId,
          user2Id: "friend-1",
          user1: { id: mockUserId, username: "Current User" },
          user2: { id: "friend-1", username: "Friend 1" },
        },
        {
          user1Id: "friend-2",
          user2Id: mockUserId,
          user1: { id: "friend-2", username: "Friend 2" },
          user2: { id: mockUserId, username: "Current User" },
        },
      ];

      (prisma.friend.findMany as jest.Mock).mockResolvedValue(mockFriends);

      const result = await getFriends();

      expect(prisma.friend.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ user1Id: mockUserId }, { user2Id: mockUserId }],
        },
        include: {
          user1: true,
          user2: true,
        },
      });

      // Should return the other user in each friendship
      expect(result).toEqual([mockFriends[0].user2, mockFriends[1].user1]);
    });
  });

  describe("getFilteredUsers", () => {
    it("should return filtered users", async () => {
      const mockUsers = [
        {
          id: "user-1",
          username: "TestUser",
          email: "test@example.com",
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await getFilteredUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          NOT: {
            OR: expect.any(Array),
          },
        },
      });

      expect(result).toEqual(mockUsers);
    });
  });

  describe("getFriendsForNewGame", () => {
    it("should return current user and friends", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriends = [
        {
          user1Id: mockUserId,
          user2Id: "friend-1",
          user1: { id: mockUserId },
          user2: { id: "friend-1" },
        },
      ];

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friend.findMany as jest.Mock).mockResolvedValue(mockFriends);

      const result = await getFriendsForNewGame();

      expect(result).toEqual([mockPrismaId, mockFriends[0].user2]);
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getFriendsForNewGame()).rejects.toThrow("User not found");
    });
  });

  describe("getOutgoingPendingFriendRequests", () => {
    it("should return outgoing pending friend requests", async () => {
      const mockRequests = [
        {
          id: "request-1",
          receiver: {
            id: "receiver-1",
            username: "Receiver",
          },
          status: "PENDING",
        },
      ];

      (prisma.friendRequest.findMany as jest.Mock).mockResolvedValue(
        mockRequests
      );

      const result = await getOutgoingPendingFriendRequests();

      expect(prisma.friendRequest.findMany).toHaveBeenCalledWith({
        where: {
          senderId: mockUserId,
          status: "PENDING",
        },
        include: {
          receiver: true,
        },
      });

      expect(result).toEqual(mockRequests);
    });
  });

  describe("getIncomingFriendRequests", () => {
    it("should return pending friend requests", async () => {
      const mockRequests = [
        {
          id: "request-1",
          sender: {
            id: "sender-1",
            username: "Sender",
          },
          status: "PENDING",
        },
      ];

      (prisma.friendRequest.findMany as jest.Mock).mockResolvedValue(
        mockRequests
      );

      const result = await getIncomingFriendRequests();

      expect(prisma.friendRequest.findMany).toHaveBeenCalledWith({
        where: {
          receiverId: mockUserId,
          status: "PENDING",
        },
        include: {
          sender: true,
        },
      });

      expect(result).toEqual(mockRequests);
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

      it("should handle single score case", async () => {
        const mockScore = {
          score: 30,
          totalCardsPlayed: 40,
          blitzPileRemaining: 5,
        };
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockScore]);

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
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

        const result = await getHighestAndLowestScore();

        expect(result).toEqual({
          highest: null,
          lowest: null,
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

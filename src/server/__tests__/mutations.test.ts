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

jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({
    capture: jest.fn(),
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

  describe("createGame", () => {
    it("should create a new game with specified players", async () => {
      const mockPlayers = [{ id: "player1" }, { id: "player2" }];
      const mockCreatedGame = {
        id: mockGameId,
        players: mockPlayers.map((p) => ({
          user: { id: p.id },
        })),
      };

      (prisma.game.create as jest.Mock).mockResolvedValue(mockCreatedGame);

      await createGame(mockPlayers);

      expect(prisma.game.create).toHaveBeenCalledWith({
        data: {
          players: {
            create: mockPlayers.map((player) => ({
              user: {
                connect: {
                  id: player.id,
                },
              },
            })),
          },
        },
        include: {
          players: {
            include: {
              user: true,
            },
          },
        },
      });

      expect(redirect).toHaveBeenCalledWith(`/games/${mockGameId}`);
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(createGame([{ id: "player1" }])).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should throw error if game creation fails", async () => {
      (prisma.game.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(createGame([{ id: "player1" }])).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("createRoundForGame", () => {
    const mockScores = [
      {
        userId: "player1",
        blitzPileRemaining: 5,
        totalCardsPlayed: 20,
      },
    ];

    it("should create a new round with scores", async () => {
      const mockGame = { id: mockGameId };
      const mockRound = { id: "round-1", scores: mockScores };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.create as jest.Mock).mockResolvedValue(mockRound);

      const result = await createRoundForGame(mockGameId, 1, mockScores);

      expect(prisma.round.create).toHaveBeenCalledWith({
        data: {
          gameId: mockGameId,
          round: 1,
          scores: {
            create: mockScores.map((score) => ({
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

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        createRoundForGame(mockGameId, 1, mockScores)
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createRoundForGame(mockGameId, 1, mockScores)
      ).rejects.toThrow("Game not found");
    });

    it("should throw error if round creation fails", async () => {
      const mockGame = { id: mockGameId };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        createRoundForGame(mockGameId, 1, mockScores)
      ).rejects.toThrow("Database error");
    });
  });

  describe("createFriendRequest", () => {
    it("should create a friend request", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockPrismaId)
        .mockResolvedValueOnce({ id: mockTargetUserId });
      (prisma.friend.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.friendRequest.findFirst as jest.Mock).mockResolvedValue(null);

      await createFriendRequest(mockTargetUserId);

      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: {
          senderId: mockUserId,
          receiverId: mockTargetUserId,
        },
      });
    });

    it("should throw error if user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(createFriendRequest(mockTargetUserId)).rejects.toThrow(
        "User not found"
      );
    });

    it("should throw error if target user is invalid", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockPrismaId)
        .mockResolvedValueOnce(null);

      await expect(createFriendRequest(mockTargetUserId)).rejects.toThrow(
        "Target user not found"
      );
    });

    it("should throw error if already friends", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockPrismaId)
        .mockResolvedValueOnce({ id: mockTargetUserId });
      (prisma.friend.findFirst as jest.Mock).mockResolvedValue({
        id: "friend-1",
      });

      await expect(createFriendRequest(mockTargetUserId)).rejects.toThrow(
        "Already friends with this user"
      );
    });

    it("should throw error if target user is the same as requesting user", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);

      await expect(createFriendRequest(mockUserId)).rejects.toThrow(
        "Cannot send friend request to yourself"
      );
    });

    it("should throw error if friend request creation fails", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockPrismaId)
        .mockResolvedValueOnce({ id: mockTargetUserId });
      (prisma.friend.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.friendRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.friendRequest.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(createFriendRequest(mockTargetUserId)).rejects.toThrow(
        "Database error"
      );
    });

    it("should throw error if friend request already exists", async () => {
      const mockPrismaId = { id: mockUserId };
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockPrismaId)
        .mockResolvedValueOnce({ id: mockTargetUserId });
      (prisma.friend.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.friendRequest.findFirst as jest.Mock).mockResolvedValue({
        id: "existing-request",
      });

      await expect(createFriendRequest(mockTargetUserId)).rejects.toThrow(
        "Friend request already exists"
      );
    });
  });

  describe("updateGameAsFinished", () => {
    const mockWinnerId = "winner-1";

    it("should update game as finished with winner", async () => {
      await updateGameAsFinished(mockGameId, mockWinnerId);

      expect(prisma.game.update).toHaveBeenCalledWith({
        where: {
          id: mockGameId,
        },
        data: {
          isFinished: true,
          winnerId: mockWinnerId,
          endedAt: expect.any(Date),
        },
      });
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        updateGameAsFinished(mockGameId, mockWinnerId)
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error if game update fails", async () => {
      (prisma.game.update as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        updateGameAsFinished(mockGameId, mockWinnerId)
      ).rejects.toThrow("Database error");
    });
  });

  describe("updateRoundScores", () => {
    const mockRoundId = "round-1";
    const mockScores = [
      {
        userId: "player1",
        blitzPileRemaining: 5,
        totalCardsPlayed: 20,
      },
    ];

    it("should update scores for a round", async () => {
      const mockGame = { id: mockGameId, isFinished: false };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.$transaction as jest.Mock).mockImplementation(
        (callback: Array<Promise<{ count: number }>>) =>
          callback.map((update) => ({ count: 1 }))
      );

      const result = await updateRoundScores(
        mockGameId,
        mockRoundId,
        mockScores
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([{ count: 1 }]);
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        updateRoundScores(mockGameId, mockRoundId, mockScores)
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error if game is finished", async () => {
      const mockGame = { id: mockGameId, isFinished: true };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, mockScores)
      ).rejects.toThrow("Cannot update scores for a finished game");
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, mockScores)
      ).rejects.toThrow("Game not found");
    });
  });

  describe("acceptFriendRequest", () => {
    const mockRequestId = "request-1";

    it("should accept friend request and create friendship", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        senderId: "sender-1",
        receiverId: mockUserId,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );

      await acceptFriendRequest(mockRequestId);

      expect(prisma.friend.create).toHaveBeenCalledWith({
        data: {
          user1Id: mockUserId,
          user2Id: mockFriendRequest.senderId,
        },
      });

      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: {
          id: mockRequestId,
        },
        data: {
          status: "ACCEPTED",
        },
      });
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(acceptFriendRequest(mockRequestId)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(acceptFriendRequest(mockRequestId)).rejects.toThrow(
        "User not found"
      );
    });

    it("should throw error if friend request is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
      });
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(acceptFriendRequest(mockRequestId)).rejects.toThrow(
        "Friend request not found"
      );
    });

    it("should throw error if user is not the receiver", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        senderId: "sender-1",
        receiverId: "different-user-id",
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );

      await expect(acceptFriendRequest(mockRequestId)).rejects.toThrow(
        "Unauthorized - not the receiver"
      );
    });

    it("should throw error if friend creation fails", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        senderId: "sender-1",
        receiverId: mockUserId,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );
      (prisma.friend.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(acceptFriendRequest(mockRequestId)).rejects.toThrow(
        "Database error"
      );
    });

    it("should throw error if friend request update fails", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        senderId: "sender-1",
        receiverId: mockUserId,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );
      (prisma.friendRequest.update as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow();
    });
  });

  describe("rejectFriendRequest", () => {
    const mockRequestId = "request-1";

    it("should reject friend request", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        receiverId: mockUserId,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );

      (prisma.friendRequest.update as jest.Mock).mockResolvedValue({
        id: mockRequestId,
        status: "REJECTED",
      });

      await rejectFriendRequest(mockRequestId);

      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: {
          id: mockRequestId,
        },
        data: {
          status: "REJECTED",
        },
      });
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should throw error if user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow(
        "User not found"
      );
    });

    it("should throw error if friend request is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
      });
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow(
        "Friend request not found"
      );
    });

    it("should throw error if user is not the receiver", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockUserId,
      });
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue({
        receiverId: "different-user-id",
      });

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should throw error if friend request update fails", async () => {
      const mockPrismaId = { id: mockUserId };
      const mockFriendRequest = {
        receiverId: mockUserId,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockPrismaId);
      (prisma.friendRequest.findUnique as jest.Mock).mockResolvedValue(
        mockFriendRequest
      );
      (prisma.friendRequest.update as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(rejectFriendRequest(mockRequestId)).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("cloneGame", () => {
    const mockOriginalGameId = "original-game-1";

    it("should clone a game with same players", async () => {
      const mockOriginalGame = {
        id: mockOriginalGameId,
        players: [{ userId: "player-1" }, { userId: "player-2" }],
      };

      const mockNewGame = {
        id: "new-game-1",
        players: mockOriginalGame.players,
      };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockOriginalGame);
      (prisma.game.create as jest.Mock).mockResolvedValue(mockNewGame);

      const result = await cloneGame(mockOriginalGameId);

      expect(prisma.game.create).toHaveBeenCalledWith({
        data: {
          players: {
            create: mockOriginalGame.players.map((player) => ({
              user: { connect: { id: player.userId } },
            })),
          },
        },
        include: {
          players: {
            include: {
              user: true,
            },
          },
        },
      });

      expect(result).toBe(mockNewGame.id);
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(cloneGame(mockOriginalGameId)).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("should throw error if game creation fails", async () => {
      const mockOriginalGame = {
        id: mockOriginalGameId,
        players: [{ userId: "player-1" }, { userId: "player-2" }],
      };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockOriginalGame);
      (prisma.game.create as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await expect(cloneGame(mockOriginalGameId)).rejects.toThrow(
        "Database error"
      );
    });

    it("should throw error if original game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(cloneGame(mockOriginalGameId)).rejects.toThrow(
        "Original game not found"
      );
    });
  });
});

import {
  createKeyMoment,
  getKeyMomentsForGame,
  deleteKeyMoment,
} from "../mutations/keyMoments";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

// Mock dependencies
jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    game: {
      findUnique: jest.fn(),
    },
    round: {
      findUnique: jest.fn(),
    },
    keyMoment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
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

describe("Key Moments Mutations", () => {
  const mockUserId = "test-user-id";
  const mockPrismaUserId = "prisma-user-id";
  const mockGameId = "test-game-id";
  const mockRoundId = "test-round-id";
  const mockKeyMomentId = "test-key-moment-id";

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: mockUserId });
    // Mock the findUnique call that getAuthenticatedUserPrismaId makes
    (prisma.user.findUnique as jest.Mock).mockImplementation((args) => {
      if (args.where?.clerk_user_id === mockUserId) {
        return Promise.resolve({ id: mockPrismaUserId });
      }
      return Promise.resolve(null);
    });
  });

  describe("createKeyMoment", () => {
    it("should create a key moment successfully", async () => {
      const mockGame = { id: mockGameId };
      const mockKeyMoment = {
        id: mockKeyMomentId,
        gameId: mockGameId,
        imageUrl: "/uploads/key-moments/test.jpg",
        description: "Test moment",
        uploadedByUserId: mockPrismaUserId,
      };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.keyMoment.create as jest.Mock).mockResolvedValue(mockKeyMoment);

      const result = await createKeyMoment(
        mockGameId,
        "/uploads/key-moments/test.jpg",
        "Test moment"
      );

      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { id: mockGameId },
      });
      expect(prisma.keyMoment.create).toHaveBeenCalledWith({
        data: {
          gameId: mockGameId,
          roundId: null,
          uploadedByUserId: mockPrismaUserId,
          imageUrl: "/uploads/key-moments/test.jpg",
          description: "Test moment",
        },
      });
      expect(result).toEqual(mockKeyMoment);
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: mockUserId,
        event: "create_key_moment",
        properties: {
          gameId: mockGameId,
          roundId: null,
          hasDescription: true,
          keyMomentId: mockKeyMomentId,
        },
      });
    });

    it("should create a key moment with roundId", async () => {
      const mockGame = { id: mockGameId };
      const mockRound = { id: mockRoundId, gameId: mockGameId };
      const mockKeyMoment = {
        id: mockKeyMomentId,
        gameId: mockGameId,
        roundId: mockRoundId,
        imageUrl: "/uploads/key-moments/test.jpg",
        uploadedByUserId: mockPrismaUserId,
      };

      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.findUnique as jest.Mock).mockResolvedValue(mockRound);
      (prisma.keyMoment.create as jest.Mock).mockResolvedValue(mockKeyMoment);

      await createKeyMoment(
        mockGameId,
        "/uploads/key-moments/test.jpg",
        undefined,
        mockRoundId
      );

      expect(prisma.round.findUnique).toHaveBeenCalledWith({
        where: { id: mockRoundId },
      });
      expect(prisma.keyMoment.create).toHaveBeenCalledWith({
        data: {
          gameId: mockGameId,
          roundId: mockRoundId,
          uploadedByUserId: mockPrismaUserId,
          imageUrl: "/uploads/key-moments/test.jpg",
          description: null,
        },
      });
    });

    it("should throw error if game not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createKeyMoment(mockGameId, "/uploads/key-moments/test.jpg")
      ).rejects.toThrow("Game not found");
    });

    it("should throw error if round not found", async () => {
      const mockGame = { id: mockGameId };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createKeyMoment(
          mockGameId,
          "/uploads/key-moments/test.jpg",
          undefined,
          mockRoundId
        )
      ).rejects.toThrow("Round not found");
    });

    it("should throw error if round does not belong to game", async () => {
      const mockGame = { id: mockGameId };
      const mockRound = { id: mockRoundId, gameId: "different-game-id" };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.findUnique as jest.Mock).mockResolvedValue(mockRound);

      await expect(
        createKeyMoment(
          mockGameId,
          "/uploads/key-moments/test.jpg",
          undefined,
          mockRoundId
        )
      ).rejects.toThrow("does not belong to this game");
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        createKeyMoment(mockGameId, "/uploads/key-moments/test.jpg")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("getKeyMomentsForGame", () => {
    it("should fetch all key moments for a game", async () => {
      const mockKeyMoments = [
        {
          id: "moment-1",
          gameId: mockGameId,
          imageUrl: "/uploads/key-moments/test1.jpg",
          uploadedBy: { id: mockPrismaUserId, username: "testuser" },
          round: { id: mockRoundId, round: 1 },
        },
        {
          id: "moment-2",
          gameId: mockGameId,
          imageUrl: "/uploads/key-moments/test2.jpg",
          uploadedBy: { id: mockPrismaUserId, username: "testuser" },
          round: null,
        },
      ];

      (prisma.keyMoment.findMany as jest.Mock).mockResolvedValue(
        mockKeyMoments
      );

      const result = await getKeyMomentsForGame(mockGameId);

      expect(prisma.keyMoment.findMany).toHaveBeenCalledWith({
        where: { gameId: mockGameId },
        include: {
          uploadedBy: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          round: {
            select: {
              id: true,
              round: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      expect(result).toEqual(mockKeyMoments);
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(getKeyMomentsForGame(mockGameId)).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  describe("deleteKeyMoment", () => {
    it("should delete a key moment successfully", async () => {
      const mockKeyMoment = {
        id: mockKeyMomentId,
        uploadedByUserId: mockPrismaUserId,
        gameId: mockGameId,
      };

      (prisma.keyMoment.findUnique as jest.Mock).mockResolvedValue(
        mockKeyMoment
      );
      (prisma.keyMoment.delete as jest.Mock).mockResolvedValue(mockKeyMoment);

      const result = await deleteKeyMoment(mockKeyMomentId);

      expect(prisma.keyMoment.findUnique).toHaveBeenCalledWith({
        where: { id: mockKeyMomentId },
      });
      expect(prisma.keyMoment.delete).toHaveBeenCalledWith({
        where: { id: mockKeyMomentId },
      });
      expect(result).toEqual({ success: true });
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: mockUserId,
        event: "delete_key_moment",
        properties: {
          keyMomentId: mockKeyMomentId,
          gameId: mockGameId,
        },
      });
    });

    it("should throw error if key moment not found", async () => {
      (prisma.keyMoment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(deleteKeyMoment(mockKeyMomentId)).rejects.toThrow(
        "Key moment not found"
      );
    });

    it("should throw error if user is not the uploader", async () => {
      const mockKeyMoment = {
        id: mockKeyMomentId,
        uploadedByUserId: "different-user-id",
        gameId: mockGameId,
      };

      (prisma.keyMoment.findUnique as jest.Mock).mockResolvedValue(
        mockKeyMoment
      );

      await expect(deleteKeyMoment(mockKeyMomentId)).rejects.toThrow(
        "You can only delete your own key moments"
      );
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(deleteKeyMoment(mockKeyMomentId)).rejects.toThrow(
        "Unauthorized"
      );
    });
  });
});

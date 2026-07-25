// Mock Resend before any imports that might use it
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
  })),
}));

import {
  createGame,
  createRoundForGame,
  updateGameAsFinished,
  updateRoundScores,
  cloneGame,
} from "../mutations";
import { requireAuthContext, requireGameInCircle } from "../mutations/common";
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
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    score: {
      create: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    guestUser: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    gamePlayers: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => Promise.all(callback)),
  },
}));

// Mock types
type AuthResult = { userId: string | null };
type AuthFn = () => Promise<AuthResult>;

const mockGetOrganizationMembershipList = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn() as jest.MockedFunction<AuthFn>,
  clerkClient: jest.fn().mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: (...args: unknown[]) =>
        mockGetOrganizationMembershipList(...args),
    },
  }),
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

jest.mock("next/server", () => ({
  after: jest.fn((cb: () => Promise<void>) => void cb()),
}));

describe("Game Mutations", () => {
  const mockUserId = "test-user-id";
  const mockGameId = "test-game-id";
  const mockTargetUserId = "target-user-id";
  const mockOrgId = "org_test123";
  const validRoster = [
    { userId: "player1", guestId: null },
    { userId: "player2", guestId: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: mockUserId,
      orgId: mockOrgId,
    });
    (prisma.round.findUnique as jest.Mock).mockResolvedValue({
      gameId: mockGameId,
    });
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
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        isFinished: false,
        winnerId: null,
        winThreshold: 75,
        players: validRoster,
      };
      const mockRound = { id: "round-1", scores: validScores };

      (prisma.game.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce({ ...mockGame, players: [], rounds: [] });
      (prisma.round.create as jest.Mock).mockResolvedValue(mockRound);

      const result = await createRoundForGame(mockGameId, 1, validScores);

      expect(prisma.round.create).toHaveBeenCalledWith({
        data: {
          gameId: mockGameId,
          round: 1,
        },
      });

      expect(result).toBe(mockRound);
    });

    it("should finalize an unfinished game when the new score crosses the threshold", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        isFinished: false,
        winnerId: null,
        winThreshold: 50,
        createdAt: new Date(),
        endedAt: null,
        players: validRoster,
      };
      const mockRound = { id: "round-2", scores: validScores };
      const completionGame = {
        ...mockGame,
        players: [
          {
            id: "game-player-1",
            gameId: mockGameId,
            userId: "player1",
            guestId: null,
            accentColor: null,
            user: {
              id: "player1",
              clerk_user_id: "clerk-player1",
              email: "player1@example.com",
              username: "Player 1",
              avatarUrl: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            guestUser: null,
          },
          {
            id: "game-player-2",
            gameId: mockGameId,
            userId: "player2",
            guestId: null,
            accentColor: null,
            user: {
              id: "player2",
              clerk_user_id: "clerk-player2",
              email: "player2@example.com",
              username: "Player 2",
              avatarUrl: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            guestUser: null,
          },
        ],
        rounds: [
          {
            id: "round-1",
            gameId: mockGameId,
            round: 1,
            createdAt: new Date(),
            scores: [
              {
                id: "score-1-player1",
                userId: "player1",
                guestId: null,
                roundId: "round-1",
                blitzPileRemaining: 0,
                totalCardsPlayed: 25,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              {
                id: "score-1-player2",
                userId: "player2",
                guestId: null,
                roundId: "round-1",
                blitzPileRemaining: 5,
                totalCardsPlayed: 20,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
          {
            id: "round-2",
            gameId: mockGameId,
            round: 2,
            createdAt: new Date(),
            scores: [
              {
                id: "score-2-player1",
                userId: "player1",
                guestId: null,
                roundId: "round-2",
                blitzPileRemaining: 0,
                totalCardsPlayed: 27,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              {
                id: "score-2-player2",
                userId: "player2",
                guestId: null,
                roundId: "round-2",
                blitzPileRemaining: 5,
                totalCardsPlayed: 20,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ],
          },
        ],
      };

      (prisma.game.findUnique as jest.Mock)
        // 1: the scoring-access check, 2: the completion re-read,
        // 3: updateGameAsFinished loading the roster for the winner + emails.
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce(completionGame)
        .mockResolvedValueOnce(completionGame);
      (prisma.round.create as jest.Mock).mockResolvedValue(mockRound);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        username: "Player 1",
      });

      await createRoundForGame(mockGameId, 2, [
        {
          userId: "player1",
          blitzPileRemaining: 0,
          totalCardsPlayed: 27,
        },
        {
          userId: "player2",
          blitzPileRemaining: 5,
          totalCardsPlayed: 20,
        },
      ]);

      expect(prisma.game.update).toHaveBeenCalledWith({
        where: { id: mockGameId },
        data: {
          isFinished: true,
          winnerId: "player1",
          endedAt: expect.any(Date),
        },
      });
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: mockUserId,
        event: "update_game_as_finished",
        properties: {
          gameId: mockGameId,
          winnerId: "player1",
          isGuestWinner: false,
        },
      });
    });

    it("should throw error if validation fails", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const invalidScores = [
        {
          userId: "player1",
          blitzPileRemaining: 5, // No blitz
          totalCardsPlayed: 20,
        },
      ];

      await expect(
        createRoundForGame(mockGameId, 1, invalidScores),
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

    it("rejects score submissions for players outside the game roster", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      await expect(
        createRoundForGame(mockGameId, 1, [
          { userId: "player1", blitzPileRemaining: 0, totalCardsPlayed: 10 },
          {
            userId: "not-in-game",
            blitzPileRemaining: 5,
            totalCardsPlayed: 20,
          },
        ]),
      ).rejects.toThrow("Scores must match the players in this game");
      expect(prisma.round.create).not.toHaveBeenCalled();
    });

    it("should throw error if database operation fails", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);
      (prisma.round.create as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      await expect(
        createRoundForGame(mockGameId, 1, validScores),
      ).rejects.toThrow("Database error");
    });

    it("should throw error if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(
        createRoundForGame(mockGameId, 1, validScores),
      ).rejects.toThrow("Unauthorized");
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        createRoundForGame(mockGameId, 1, validScores),
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
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        isFinished: false,
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce({
          ...mockGame,
          winnerId: null,
          winThreshold: 75,
          players: [],
          rounds: [],
        });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 1 }]);

      const result = await updateRoundScores(
        mockGameId,
        mockRoundId,
        validScores,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([{ count: 1 }]);
    });

    it("should throw error if validation fails", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        isFinished: false,
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      const invalidScores = [
        {
          userId: "player1",
          blitzPileRemaining: 5, // No blitz
          totalCardsPlayed: 20,
        },
      ];

      await expect(
        updateRoundScores(mockGameId, mockRoundId, invalidScores),
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

    it("rejects round edits for players outside the game roster", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        isFinished: false,
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, [
          {
            userId: "player1",
            blitzPileRemaining: 0,
            totalCardsPlayed: 10,
          },
          {
            userId: "not-in-game",
            blitzPileRemaining: 5,
            totalCardsPlayed: 20,
          },
        ]),
      ).rejects.toThrow("Scores must match the players in this game");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should allow editing finished games", async () => {
      const mockGame = {
        id: mockGameId,
        kind: "CIRCLE",
        isFinished: true,
        organizationId: mockOrgId,
        players: validRoster,
      };
      (prisma.game.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockGame)
        .mockResolvedValueOnce({
          ...mockGame,
          winnerId: "player1",
          winThreshold: 75,
          players: [],
          rounds: [],
        });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 1 }]);

      const result = await updateRoundScores(
        mockGameId,
        mockRoundId,
        validScores,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([{ count: 1 }]);
    });

    it("should throw error if game is not found", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateRoundScores(mockGameId, mockRoundId, validScores),
      ).rejects.toThrow("Game not found");
    });
  });

  describe("updateGameAsFinished", () => {
    it("rejects a winner who is not on the game roster", async () => {
      const game = {
        id: mockGameId,
        kind: "CIRCLE",
        organizationId: mockOrgId,
        players: [
          {
            userId: "player1",
            guestId: null,
            user: {
              id: "player1",
              username: "Player 1",
              email: "player1@example.com",
              clerk_user_id: "clerk-player1",
            },
            guestUser: null,
          },
        ],
      };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(game);

      await expect(
        updateGameAsFinished(mockGameId, "not-in-game"),
      ).rejects.toThrow("Winner must be a player in this game");
      expect(prisma.game.update).not.toHaveBeenCalled();
    });
  });

  describe("createGame", () => {
    beforeEach(() => {
      // Interactive transaction: invoke the callback with the prisma mock as tx
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) =>
          callback(prisma),
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "prisma-user-id",
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.game.create as jest.Mock).mockResolvedValue({
        id: "new-game-id",
      });
      (prisma.gamePlayers.create as jest.Mock).mockResolvedValue({});
      (prisma.gamePlayers.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
    });

    it("should create a game with organizationId from active circle", async () => {
      // Mock Clerk membership check — player-2 has clerk ID "clerk-player-2"
      mockGetOrganizationMembershipList.mockResolvedValue({
        data: [
          { publicUserData: { userId: mockUserId } },
          { publicUserData: { userId: "clerk-player-2" } },
        ],
      });
      // Mock Prisma lookup of clerk_user_ids for submitted player IDs
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: "prisma-user-id", clerk_user_id: mockUserId, accentColor: null },
        { id: "player-2", clerk_user_id: "clerk-player-2", accentColor: null },
      ]);

      const players = [
        { id: "prisma-user-id", username: "TestUser" },
        { id: "player-2", username: "Player2" },
      ];

      const result = await createGame(players);

      expect(prisma.game.create).toHaveBeenCalledWith({
        data: {
          organizationId: mockOrgId,
        },
      });
      expect(result).toEqual({ gameId: "new-game-id" });
    });

    it("should add all players in a single batched write", async () => {
      mockGetOrganizationMembershipList.mockResolvedValue({
        data: [
          { publicUserData: { userId: mockUserId } },
          { publicUserData: { userId: "clerk-player-2" } },
        ],
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: "prisma-user-id", clerk_user_id: mockUserId, accentColor: null },
        { id: "player-2", clerk_user_id: "clerk-player-2", accentColor: null },
      ]);

      await createGame([
        { id: "prisma-user-id", username: "TestUser" },
        { id: "player-2", username: "Player2" },
      ]);

      expect(prisma.gamePlayers.createMany).toHaveBeenCalledTimes(1);
      const { data: rows } = (prisma.gamePlayers.createMany as jest.Mock).mock
        .calls[0][0];
      expect(rows).toEqual([
        expect.objectContaining({
          gameId: "new-game-id",
          userId: "prisma-user-id",
        }),
        expect.objectContaining({ gameId: "new-game-id", userId: "player-2" }),
      ]);
      expect(prisma.gamePlayers.create).not.toHaveBeenCalled();
    });

    it("should create guest players and map them into the batched write", async () => {
      (prisma.guestUser.create as jest.Mock).mockResolvedValue({
        id: "guest-db-1",
      });

      await createGame([
        { id: "temp-guest-1", username: "Guest Bob", isGuest: true },
      ]);

      expect(prisma.guestUser.create).toHaveBeenCalledWith({
        data: {
          name: "Guest Bob",
          createdById: "prisma-user-id",
          organizationId: mockOrgId,
        },
      });
      expect(prisma.gamePlayers.createMany).toHaveBeenCalledTimes(1);
      const { data: rows } = (prisma.gamePlayers.createMany as jest.Mock).mock
        .calls[0][0];
      expect(rows).toEqual([
        expect.objectContaining({
          gameId: "new-game-id",
          guestId: "guest-db-1",
        }),
      ]);
    });

    it("should accept members beyond Clerk's default membership page size (#246)", async () => {
      // 12-member circle; the selected player is the 12th member. Clerk's
      // API returns only 10 memberships when no limit is passed.
      const memberships = Array.from({ length: 12 }, (_, i) => ({
        publicUserData: { userId: `clerk-member-${i + 1}` },
      }));
      mockGetOrganizationMembershipList.mockImplementation(
        (params?: { limit?: number; offset?: number }) => {
          const limit = params?.limit ?? 10;
          const offset = params?.offset ?? 0;
          return Promise.resolve({
            data: memberships.slice(offset, offset + limit),
          });
        },
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: "player-12",
          clerk_user_id: "clerk-member-12",
          accentColor: null,
        },
      ]);

      const result = await createGame([
        { id: "player-12", username: "TwelfthMember" },
      ]);

      expect(result).toEqual({ gameId: "new-game-id" });
    });

    it("should throw if no active circle", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        orgId: null,
      });

      await expect(createGame([{ id: "user-1" }])).rejects.toThrow(
        "No active circle",
      );
    });
  });

  describe("requireAuthContext", () => {
    it("returns org context when a circle is active", async () => {
      const ctx = await requireAuthContext("org");

      expect(ctx.user.userId).toBe(mockUserId);
      expect(ctx.orgId).toBe(mockOrgId);
      expect(ctx.posthog).toBeDefined();
    });

    it("resolves the internal prisma id when required", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "prisma-user-id",
      });

      const ctx = await requireAuthContext("orgWithPrismaId");

      expect(ctx.orgId).toBe(mockOrgId);
      expect(ctx.prismaUserId).toBe("prisma-user-id");
    });

    it("does not require a circle for prismaId-only actions", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        orgId: null,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "prisma-user-id",
      });

      const ctx = await requireAuthContext("prismaId");

      expect(ctx.prismaUserId).toBe("prisma-user-id");
    });

    it("throws if the prisma user is missing", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(requireAuthContext("orgWithPrismaId")).rejects.toThrow(
        "User not found",
      );
    });

    it("throws if user has no active circle", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        orgId: null,
      });

      await expect(requireAuthContext("org")).rejects.toThrow(
        "No active circle",
      );
    });

    it("throws if user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: null,
        orgId: null,
      });

      await expect(requireAuthContext("user")).rejects.toThrow("Unauthorized");
    });
  });

  describe("requireGameInCircle", () => {
    it("returns the game when it belongs to the active circle", async () => {
      const mockGame = { id: mockGameId, organizationId: mockOrgId };
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(mockGame);

      await expect(requireGameInCircle(mockGameId, mockOrgId)).resolves.toEqual(
        mockGame,
      );
    });

    it("throws when the game does not exist", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(requireGameInCircle(mockGameId, mockOrgId)).rejects.toThrow(
        "Game not found",
      );
    });

    it("throws when the game belongs to another circle", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue({
        id: mockGameId,
        organizationId: "org_other",
      });

      await expect(requireGameInCircle(mockGameId, mockOrgId)).rejects.toThrow(
        "Game does not belong to your active circle",
      );
    });
  });
});

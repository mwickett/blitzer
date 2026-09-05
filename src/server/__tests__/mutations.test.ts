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
  updateRoundScores,
  cloneGame,
} from "../mutations";
import { requireAuthContext, requireGameInCircle } from "../mutations/common";
import prisma from "../db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";
import { after } from "next/server";
import { GAME_RULES } from "@/lib/validation/gameRules";

// Mock dependencies
jest.mock("../db/db", () => {
  const client = {
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
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };
  // Set after the literal so `client` is not referenced inside its own
  // initializer. Supports both Prisma forms: an array of operations, and the
  // interactive callback form, whose `tx` is this same mock — so assertions on
  // prisma.round.create and prisma.score.createMany keep working inside a
  // transaction. jest.clearAllMocks() preserves implementations, so this
  // survives between tests.
  client.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => unknown)(client)
      : Promise.all(arg as unknown[]),
  );
  return { __esModule: true, default: client };
});

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
  after: jest.fn(),
}));

describe("Game Mutations", () => {
  const mockUserId = "test-user-id";
  const mockGameId = "test-game-id";
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

  describe("score actions", () => {
    const scores = [
      { userId: "player1", totalCardsPlayed: 30, blitzPileRemaining: 0 },
      { userId: "player2", totalCardsPlayed: 20, blitzPileRemaining: 5 },
    ];
    const stored = (revision = 0) => ({
      id: "round-1",
      gameId: mockGameId,
      round: 1,
      revision,
      scores: scores.map((score) => ({ ...score, guestId: null })),
    });
    const game = () => ({
      id: mockGameId,
      kind: "CIRCLE",
      organizationId: mockOrgId,
      startedAt: new Date(),
      isFinished: false,
      winnerId: null,
      endedAt: null,
      winThreshold: 25,
      players: validRoster.map((player) => ({
        ...player,
        user: {
          id: player.userId,
          username: player.userId,
          clerk_user_id: player.userId,
        },
      })),
      rounds: [],
    });
    beforeEach(() => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue(game());
      (prisma.round.create as jest.Mock).mockResolvedValue(stored());
      (prisma.game.update as jest.Mock).mockResolvedValue({});
    });

    it.each([-1, 41, 0.5, NaN, Infinity, "10", null])(
      "rejects cards %p before a write",
      async (cards) => {
        const invalid = [{ ...scores[0], totalCardsPlayed: cards }, scores[1]];
        const result = await createRoundForGame(
          mockGameId,
          1,
          invalid as typeof scores,
        );
        expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.round.create).not.toHaveBeenCalled();
      },
    );

    it.each([0, -1, 0.5])("rejects round number %p", async (number) => {
      expect(
        await createRoundForGame(mockGameId, number, scores),
      ).toMatchObject({ ok: false, reason: "invalid_input" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects missing blitz, duplicate, ambiguous, and foreign participants", async () => {
      for (const invalid of [
        scores.map((score) => ({ ...score, blitzPileRemaining: 1 })),
        [scores[0], scores[0]],
        [{ ...scores[0], guestId: "guest" }, scores[1]],
        [{ ...scores[0], userId: "outsider" }, scores[1]],
      ]) {
        expect(await createRoundForGame(mockGameId, 1, invalid)).toMatchObject({
          ok: false,
          reason: "invalid_input",
        });
      }
      expect(prisma.round.create).not.toHaveBeenCalled();
    });

    it("rejects skipped and genuinely new finished-game rounds", async () => {
      expect(await createRoundForGame(mockGameId, 2, scores)).toMatchObject({
        ok: false,
        reason: "stale_round",
      });
      (prisma.game.findUnique as jest.Mock).mockResolvedValue({
        ...game(),
        isFinished: true,
      });
      expect(await createRoundForGame(mockGameId, 1, scores)).toMatchObject({
        ok: false,
        reason: "game_finished",
      });
      expect(prisma.round.create).not.toHaveBeenCalled();
    });

    it("derives and commits completion before scheduling its email callback", async () => {
      const result = await createRoundForGame(mockGameId, 1, scores);
      expect(result).toMatchObject({
        ok: true,
        round: { id: "round-1", revision: 0 },
      });
      expect(prisma.game.update).toHaveBeenCalledWith({
        where: { id: mockGameId },
        data: {
          isFinished: true,
          winnerId: "player1",
          endedAt: expect.any(Date),
        },
      });
      expect(after).toHaveBeenCalledTimes(1);
      expect(
        (prisma.game.update as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan((after as jest.Mock).mock.invocationCallOrder[0]);
    });

    it("does not notify after a failed completion transaction", async () => {
      (prisma.game.update as jest.Mock).mockRejectedValueOnce(
        new Error("write failed"),
      );
      await expect(createRoundForGame(mockGameId, 1, scores)).rejects.toThrow(
        "write failed",
      );
      expect(after).not.toHaveBeenCalled();
    });

    it("returns the persisted final round on identical retries without notification", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue({
        ...game(),
        isFinished: true,
        winnerId: "player1",
        rounds: [stored()],
      });
      expect(await createRoundForGame(mockGameId, 1, scores)).toEqual({
        ok: true,
        round: stored(),
      });
      expect(prisma.round.create).not.toHaveBeenCalled();
      expect(prisma.game.update).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
      expect(
        await createRoundForGame(mockGameId, 1, [
          { ...scores[0], totalCardsPlayed: 31 },
          scores[1],
        ]),
      ).toMatchObject({ ok: false, reason: "round_conflict" });
    });

    it("requires the captured revision for a changed edit", async () => {
      (prisma.game.findUnique as jest.Mock).mockResolvedValue({
        ...game(),
        rounds: [stored(1)],
      });
      expect(
        await updateRoundScores(
          mockGameId,
          "round-1",
          [{ ...scores[0], totalCardsPlayed: 31 }, scores[1]],
          0,
        ),
      ).toMatchObject({ ok: false, reason: "round_conflict" });
      expect(
        await updateRoundScores(
          mockGameId,
          "round-1",
          scores,
          undefined as unknown as number,
        ),
      ).toMatchObject({ ok: false, reason: "invalid_input" });
      expect(after).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated and wrong-circle callers", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
      await expect(createRoundForGame(mockGameId, 1, scores)).rejects.toThrow(
        "Unauthorized",
      );
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockUserId,
        orgId: "other",
      });
      await expect(createRoundForGame(mockGameId, 1, scores)).rejects.toThrow(
        "active circle",
      );
      expect(prisma.round.create).not.toHaveBeenCalled();
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

    it("refuses to seat more than the maximum number of players", async () => {
      const players = Array.from(
        { length: GAME_RULES.MAX_PLAYERS + 1 },
        (_, i) => ({ id: `player-${i}`, username: `Player${i}` }),
      );

      expect(await createGame(players)).toMatchObject({
        ok: false,
        reason: "invalid_input",
      });
      expect(prisma.game.create).not.toHaveBeenCalled();
    });

    it.each([
      { users: [], threshold: 75 },
      { users: [{ id: "one" }], threshold: 75 },
      { users: [{ id: "one" }, { id: "one" }], threshold: 75 },
      {
        users: [{ id: "one" }, { id: "guest", isGuest: true, username: " " }],
        threshold: 75,
      },
      { users: [{ id: "one" }, { id: "two" }], threshold: -1 },
      { users: [{ id: "one" }, { id: "two" }], threshold: 25.5 },
      { users: [{ id: "one" }, { id: "two" }], threshold: 201 },
    ])(
      "validates Circle configuration before any write: %p",
      async ({ users, threshold }) => {
        expect(await createGame(users, threshold)).toMatchObject({
          ok: false,
          reason: "invalid_input",
        });
        expect(prisma.game.create).not.toHaveBeenCalled();
        expect(prisma.guestUser.create).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );

    it("rejects nonexistent registered players before creating a game", async () => {
      expect(
        await createGame([{ id: "missing-one" }, { id: "missing-two" }]),
      ).toMatchObject({ ok: false, reason: "invalid_input" });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("seats a full table of the maximum number of players", async () => {
      const players = Array.from(
        { length: GAME_RULES.MAX_PLAYERS },
        (_, i) => ({ id: `guest-${i}`, username: `Guest${i}`, isGuest: true }),
      );
      (prisma.guestUser.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.guestUser.create as jest.Mock).mockImplementation(
        async ({ data }: { data: { name: string } }) => ({
          id: `created-${data.name}`,
          name: data.name,
        }),
      );

      await expect(createGame(players)).resolves.toBeDefined();
      expect(prisma.game.create).toHaveBeenCalled();
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
          winThreshold: 75,
        },
      });
      expect(result).toEqual({ ok: true, gameId: "new-game-id" });
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
      (prisma.guestUser.create as jest.Mock)
        .mockResolvedValue({
          id: "guest-db-1",
        })
        .mockResolvedValueOnce({ id: "guest-db-1" })
        .mockResolvedValueOnce({ id: "guest-db-2" });

      await createGame([
        { id: "temp-guest-1", username: "Guest Bob", isGuest: true },
        { id: "temp-guest-2", username: "Guest Sue", isGuest: true },
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
        expect.objectContaining({
          gameId: "new-game-id",
          guestId: "guest-db-2",
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
        { id: "guest-2", username: "Guest", isGuest: true },
      ]);

      expect(result).toEqual({ ok: true, gameId: "new-game-id" });
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

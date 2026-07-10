import prisma from "../db/db";
import {
  createPickupGame,
  joinPickupGame,
  joinPickupGameByCode,
  startPickupGame,
} from "../mutations/lobbies";
import {
  ensureCurrentPrismaUser,
  requireAuthContext,
} from "../mutations/common";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("../mutations/common", () => ({
  ensureCurrentPrismaUser: jest.fn(),
  requireAuthContext: jest.fn(),
}));

jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    game: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

describe("pickup lobby mutations", () => {
  const capture = jest.fn();
  const host = { id: "host-id", accentColor: "#3b82f6" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuthContext as jest.Mock).mockResolvedValue({
      user: { userId: "clerk-host" },
      posthog: { capture },
    });
    (ensureCurrentPrismaUser as jest.Mock).mockResolvedValue(host);
  });

  function startTransaction(game: {
    hostUserId: string;
    startedAt: Date | null;
    playerCount: number;
  }) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "game-id" }]),
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: "game-id",
          kind: "PICKUP",
          hostUserId: game.hostUserId,
          startedAt: game.startedAt,
          _count: { players: game.playerCount },
        }),
        update: jest.fn().mockResolvedValue({ id: "game-id" }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    return tx;
  }

  it("rejects joining after a pickup game has started", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "game-id" }]),
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: "game-id",
          kind: "PICKUP",
          startedAt: new Date(),
          isFinished: false,
          players: [],
        }),
      },
      gamePlayers: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );

    await expect(joinPickupGame("expired-token")).rejects.toThrow(
      "This lobby is no longer accepting players",
    );
    expect(tx.gamePlayers.create).not.toHaveBeenCalled();
  });

  it("rejects a non-host starting the lobby", async () => {
    const tx = startTransaction({
      hostUserId: "somebody-else",
      startedAt: null,
      playerCount: 2,
    });

    await expect(startPickupGame("game-id")).rejects.toThrow(
      "Only the host can start this game",
    );
    expect(tx.game.update).not.toHaveBeenCalled();
  });

  it("requires at least two players to start", async () => {
    const tx = startTransaction({
      hostUserId: host.id,
      startedAt: null,
      playerCount: 1,
    });

    await expect(startPickupGame("game-id")).rejects.toThrow(
      "At least two players are needed to start",
    );
    expect(tx.game.update).not.toHaveBeenCalled();
  });

  it("starts once, revokes both join credentials, and tracks the start", async () => {
    const tx = startTransaction({
      hostUserId: host.id,
      startedAt: null,
      playerCount: 2,
    });

    await expect(startPickupGame("game-id")).resolves.toEqual({
      gameId: "game-id",
    });
    expect(tx.game.update).toHaveBeenCalledWith({
      where: { id: "game-id" },
      data: {
        startedAt: expect.any(Date),
        joinToken: null,
        joinCode: null,
      },
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "clerk-host",
      event: "start_pickup_game",
      properties: { game_id: "game-id" },
    });
  });

  it("does not double-count an idempotent start", async () => {
    startTransaction({
      hostUserId: host.id,
      startedAt: new Date(),
      playerCount: 2,
    });

    await startPickupGame("game-id");
    expect(capture).not.toHaveBeenCalled();
  });

  it("authenticates before looking up a lobby code", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(joinPickupGameByCode("ABC234")).rejects.toThrow(
      "We couldn't find that lobby code",
    );
    expect(requireAuthContext).toHaveBeenCalledWith("user");
    expect(
      (requireAuthContext as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (prisma.game.findUnique as jest.Mock).mock.invocationCallOrder[0],
    );
  });

  it("retries the entire transaction after a credential collision", async () => {
    const createdGame = {
      id: "game-id",
      joinToken: "new-token",
    };
    const tx = {
      game: { create: jest.fn().mockResolvedValue(createdGame) },
      guestUser: { create: jest.fn() },
      gamePlayers: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: "P2002" })
      .mockImplementationOnce((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      );

    await expect(createPickupGame({})).resolves.toEqual({
      gameId: "game-id",
      joinToken: "new-token",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

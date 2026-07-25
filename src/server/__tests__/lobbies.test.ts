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
import { LOBBY_MAX_AGE_MS, MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// requireActual below pulls in the real common.ts, which imports Clerk's ESM
// build. Nothing here exercises Clerk — the auth seams are stubbed — so stub
// the module rather than teaching Jest to parse it.
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
}));

// Only the two auth seams are stubbed — the pure helpers (isUniqueConstraintError)
// stay real so this suite exercises the same collision detection as production.
jest.mock("../mutations/common", () => ({
  ...jest.requireActual("../mutations/common"),
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

  function joinTransaction(
    lobby: Partial<{
      startedAt: Date | null;
      isFinished: boolean;
      createdAt: Date;
      players: {
        id: string;
        userId: string | null;
        accentColor: string | null;
      }[];
    }> = {},
  ) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "game-id" }]),
      game: {
        findUnique: jest.fn().mockResolvedValue({
          id: "game-id",
          kind: "PICKUP",
          startedAt: lobby.startedAt ?? null,
          isFinished: lobby.isFinished ?? false,
          createdAt: lobby.createdAt ?? new Date(),
          players: lobby.players ?? [],
        }),
      },
      gamePlayers: { create: jest.fn() },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx),
    );
    return tx;
  }

  const seatedPlayers = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `gp-${index}`,
      userId: `player-${index}`,
      accentColor: null,
    }));

  // Expected rejections come back as values, not exceptions: throwing would
  // file an ordinary full lobby in Sentry and mask the message in production.
  it("rejects joining after a pickup game has started", async () => {
    const tx = joinTransaction({ startedAt: new Date() });

    await expect(joinPickupGame("expired-token")).resolves.toMatchObject({
      ok: false,
      reason: "not_open",
    });
    expect(tx.gamePlayers.create).not.toHaveBeenCalled();
  });

  it("adds the joining player with a free accent color", async () => {
    const tx = joinTransaction({ players: seatedPlayers(2) });

    await expect(joinPickupGame("token")).resolves.toEqual({
      ok: true,
      gameId: "game-id",
    });
    expect(tx.gamePlayers.create).toHaveBeenCalledWith({
      data: {
        gameId: "game-id",
        userId: host.id,
        accentColor: host.accentColor,
      },
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: "clerk-host",
      event: "join_pickup_game",
      properties: { game_id: "game-id" },
    });
  });

  it("rejects joining a lobby that is already at capacity", async () => {
    const tx = joinTransaction({ players: seatedPlayers(MAX_PICKUP_PLAYERS) });

    await expect(joinPickupGame("token")).resolves.toMatchObject({
      ok: false,
      reason: "full",
    });
    expect(tx.gamePlayers.create).not.toHaveBeenCalled();
  });

  it("records a rejection as a product event rather than an exception", async () => {
    joinTransaction({ players: seatedPlayers(MAX_PICKUP_PLAYERS) });

    await joinPickupGame("token");

    expect(capture).toHaveBeenCalledWith({
      distinctId: "clerk-host",
      event: "join_pickup_game_rejected",
      properties: { reason: "full", game_id: "game-id" },
    });
  });

  it("still lets a seated player back into a full lobby", async () => {
    const players = seatedPlayers(MAX_PICKUP_PLAYERS);
    players[0].userId = host.id;
    const tx = joinTransaction({ players });

    await expect(joinPickupGame("token")).resolves.toEqual({
      ok: true,
      gameId: "game-id",
    });
    expect(tx.gamePlayers.create).not.toHaveBeenCalled();
  });

  it("rejects joining a lobby that has aged out", async () => {
    const tx = joinTransaction({
      createdAt: new Date(Date.now() - LOBBY_MAX_AGE_MS - 1_000),
    });

    await expect(joinPickupGame("token")).resolves.toMatchObject({
      ok: false,
      reason: "expired",
    });
    expect(tx.gamePlayers.create).not.toHaveBeenCalled();
  });

  it("refuses to seat more guests than the table holds", async () => {
    await expect(
      createPickupGame({
        guestNames: Array.from(
          { length: MAX_PICKUP_PLAYERS },
          (_, index) => `Guest ${index}`,
        ),
      }),
    ).resolves.toMatchObject({ ok: false, reason: "too_many_guests" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a win threshold outside the supported range", async () => {
    await expect(createPickupGame({ winThreshold: 5 })).resolves.toMatchObject({
      ok: false,
      reason: "invalid_threshold",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-host starting the lobby", async () => {
    const tx = startTransaction({
      hostUserId: "somebody-else",
      startedAt: null,
      playerCount: 2,
    });

    await expect(startPickupGame("game-id")).resolves.toMatchObject({
      ok: false,
      reason: "not_host",
    });
    expect(tx.game.update).not.toHaveBeenCalled();
  });

  it("requires at least two players to start", async () => {
    const tx = startTransaction({
      hostUserId: host.id,
      startedAt: null,
      playerCount: 1,
    });

    await expect(startPickupGame("game-id")).resolves.toMatchObject({
      ok: false,
      reason: "too_few_players",
    });
    expect(tx.game.update).not.toHaveBeenCalled();
  });

  it("starts once, revokes both join credentials, and tracks the start", async () => {
    const tx = startTransaction({
      hostUserId: host.id,
      startedAt: null,
      playerCount: 2,
    });

    await expect(startPickupGame("game-id")).resolves.toEqual({
      ok: true,
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

    await expect(joinPickupGameByCode("ABC234")).resolves.toMatchObject({
      ok: false,
      reason: "code_not_found",
    });
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
      ok: true,
      gameId: "game-id",
      joinToken: "new-token",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

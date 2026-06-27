import {
  buildPredictionProfiles,
  getPredictionProfilesForGame,
  HISTORY_SAMPLE_LIMIT_PER_PLAYER,
  RECENT_DELTA_LIMIT,
} from "../queries/predictionProfiles";
import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";

jest.mock("@/server/db/db", () => {
  const mockPrisma = {
    game: {
      findUnique: jest.fn(),
    },
    score: {
      findMany: jest.fn(),
    },
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

describe("buildPredictionProfiles", () => {
  it("summarizes score samples by user and guest player id", () => {
    const profiles = buildPredictionProfiles(["user-1", "guest-1"], [
      {
        userId: "user-1",
        guestId: null,
        totalCardsPlayed: 20,
        blitzPileRemaining: 0,
      },
      {
        userId: "user-1",
        guestId: null,
        totalCardsPlayed: 10,
        blitzPileRemaining: 5,
      },
      {
        userId: null,
        guestId: "guest-1",
        totalCardsPlayed: 30,
        blitzPileRemaining: 0,
      },
      {
        userId: "other-user",
        guestId: null,
        totalCardsPlayed: 40,
        blitzPileRemaining: 0,
      },
    ]);

    expect(profiles["user-1"]).toMatchObject({
      playerId: "user-1",
      roundsPlayed: 2,
      meanDelta: 10,
      blitzRate: 0.5,
      meanCardsPlayed: 15,
      meanBlitzPileRemaining: 2.5,
      recentDeltas: [20, 0],
    });
    expect(profiles["user-1"].stdDelta).toBeCloseTo(14.142, 3);

    expect(profiles["guest-1"]).toMatchObject({
      playerId: "guest-1",
      roundsPlayed: 1,
      meanDelta: 30,
      stdDelta: 0,
      blitzRate: 1,
      meanCardsPlayed: 30,
      meanBlitzPileRemaining: 0,
      recentDeltas: [30],
    });
    expect(profiles).not.toHaveProperty("other-user");
  });

  it("keeps recent deltas capped while retaining aggregate sample counts", () => {
    const samples = Array.from({ length: RECENT_DELTA_LIMIT + 5 }, (_, index) => ({
      userId: "user-1",
      guestId: null,
      totalCardsPlayed: index,
      blitzPileRemaining: 0,
    }));

    const profiles = buildPredictionProfiles(["user-1"], samples);

    expect(profiles["user-1"].roundsPlayed).toBe(RECENT_DELTA_LIMIT + 5);
    expect(profiles["user-1"].recentDeltas).toHaveLength(RECENT_DELTA_LIMIT);
    expect(profiles["user-1"].recentDeltas.slice(0, 3)).toEqual([0, 1, 2]);
    expect(profiles["user-1"].recentDeltas.at(-1)).toBe(RECENT_DELTA_LIMIT - 1);
  });
});

describe("getPredictionProfilesForGame", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-user",
      orgId: "org-1",
    });
  });

  it("does not fetch score history when the viewer is not authenticated", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: null,
      orgId: null,
    });
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [{ userId: "user-1", guestId: null }],
    });

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("does not fetch score history when no active circle is selected", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({
      userId: "clerk-user",
      orgId: null,
    });
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [{ userId: "user-1", guestId: null }],
    });

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("does not fetch score history when the game is missing", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("does not fetch score history for legacy games without a circle", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: null,
      players: [{ userId: "user-1", guestId: null }],
    });

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("does not fetch score history for a different active circle", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-2",
      players: [{ userId: "user-1", guestId: null }],
    });

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("does not fetch score history when a game has no resolvable players", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [{ userId: null, guestId: null }],
    });

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});
    expect(prisma.score.findMany).not.toHaveBeenCalled();
  });

  it("fetches prior same-circle score samples for current user and guest players", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [
        { userId: "user-1", guestId: null },
        { userId: null, guestId: "guest-1" },
      ],
    });
    (prisma.score.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          userId: "user-1",
          guestId: null,
          totalCardsPlayed: 20,
          blitzPileRemaining: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: null,
          guestId: "guest-1",
          totalCardsPlayed: 25,
          blitzPileRemaining: 5,
        },
      ]);

    const profiles = await getPredictionProfilesForGame("game-1");

    expect(prisma.score.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: "user-1",
        round: {
          gameId: { not: "game-1" },
          game: {
            organizationId: "org-1",
            isFinished: true,
          },
        },
      },
      select: {
        userId: true,
        guestId: true,
        totalCardsPlayed: true,
        blitzPileRemaining: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_SAMPLE_LIMIT_PER_PLAYER,
    });
    expect(prisma.score.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        guestId: "guest-1",
        round: {
          gameId: { not: "game-1" },
          game: {
            organizationId: "org-1",
            isFinished: true,
          },
        },
      },
      select: {
        userId: true,
        guestId: true,
        totalCardsPlayed: true,
        blitzPileRemaining: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: HISTORY_SAMPLE_LIMIT_PER_PLAYER,
    });
    expect(profiles["user-1"].recentDeltas).toEqual([20]);
    expect(profiles["guest-1"].recentDeltas).toEqual([15]);
  });

  it("supports user-only games without adding a guest query", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [{ userId: "user-1", guestId: null }],
    });
    (prisma.score.findMany as jest.Mock).mockResolvedValueOnce([]);

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});

    expect(prisma.score.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("supports guest-only games without adding a user query", async () => {
    (prisma.game.findUnique as jest.Mock).mockResolvedValue({
      id: "game-1",
      organizationId: "org-1",
      players: [{ userId: null, guestId: "guest-1" }],
    });
    (prisma.score.findMany as jest.Mock).mockResolvedValueOnce([]);

    await expect(getPredictionProfilesForGame("game-1")).resolves.toEqual({});

    expect(prisma.score.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.score.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ guestId: "guest-1" }),
      })
    );
  });
});

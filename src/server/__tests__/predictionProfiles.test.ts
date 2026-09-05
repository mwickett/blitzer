import {
  buildPredictionProfiles,
  getPredictionProfilesForGame,
  HISTORY_SAMPLE_LIMIT_PER_PLAYER,
  RECENT_DELTA_LIMIT,
} from "../queries/predictionProfiles";
import prisma from "@/server/db/db";

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

describe("buildPredictionProfiles", () => {
  it("summarizes score samples by user and guest player id", () => {
    const profiles = buildPredictionProfiles(
      ["user-1", "guest-1"],
      [
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
      ],
    );

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
    const samples = Array.from(
      { length: RECENT_DELTA_LIMIT + 5 },
      (_, index) => ({
        userId: "user-1",
        guestId: null,
        totalCardsPlayed: index,
        blitzPileRemaining: 0,
      }),
    );

    const profiles = buildPredictionProfiles(["user-1"], samples);

    expect(profiles["user-1"].roundsPlayed).toBe(RECENT_DELTA_LIMIT + 5);
    expect(profiles["user-1"].recentDeltas).toHaveLength(RECENT_DELTA_LIMIT);
    expect(profiles["user-1"].recentDeltas.slice(0, 3)).toEqual([0, 1, 2]);
    expect(profiles["user-1"].recentDeltas.at(-1)).toBe(RECENT_DELTA_LIMIT - 1);
  });
});

describe("getPredictionProfilesForGame", () => {
  const game = {
    id: "game-1",
    organizationId: "org-1",
    players: [
      { userId: "user-1", guestId: null },
      { userId: null, guestId: "guest-1" },
    ],
  };
  const viewer = { userId: "clerk-user", orgId: "org-1" };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    { game, viewer: { userId: null, orgId: null } },
    { game, viewer: { userId: "clerk-user", orgId: null } },
    { game: null, viewer },
    { game: { ...game, organizationId: null }, viewer },
    { game: { ...game, organizationId: "org-2" }, viewer },
    { game: { ...game, players: [] }, viewer },
  ])(
    "skips optional history outside the authenticated game scope: %p",
    async ({ game, viewer }) => {
      expect(await getPredictionProfilesForGame(game, viewer)).toEqual({});
      expect(prisma.game.findUnique).not.toHaveBeenCalled();
      expect(prisma.score.findMany).not.toHaveBeenCalled();
    },
  );

  it("reuses the loaded game and bounds history to each participant's completed same-circle games", async () => {
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
    const profiles = await getPredictionProfilesForGame(game, viewer);
    expect(prisma.game.findUnique).not.toHaveBeenCalled();
    expect(prisma.score.findMany).toHaveBeenCalledTimes(2);
    for (const [index, identity] of [
      { userId: "user-1" },
      { guestId: "guest-1" },
    ].entries()) {
      expect(prisma.score.findMany).toHaveBeenNthCalledWith(index + 1, {
        where: {
          ...identity,
          round: {
            gameId: { not: "game-1" },
            game: { organizationId: "org-1", isFinished: true },
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
    }
    expect(profiles["user-1"].recentDeltas).toEqual([20]);
    expect(profiles["guest-1"].recentDeltas).toEqual([15]);
  });

  it("fails soft when optional history is unavailable", async () => {
    (prisma.score.findMany as jest.Mock).mockRejectedValue(
      new Error("database unavailable"),
    );
    expect(await getPredictionProfilesForGame(game, viewer)).toEqual({});
  });
});

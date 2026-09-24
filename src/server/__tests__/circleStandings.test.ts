import {
  getCircleStandings,
  getCircleStandingsForOrg,
} from "../queries/circleStandings";
import { requireAuthContext } from "../mutations/common";
import prisma from "../db/db";

jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/generated/prisma/client", () => ({
  Prisma: {
    sql: jest.fn((strings, ...values) => ({ strings, values })),
    raw: jest.fn((value) => ({ raw: value })),
  },
}));

jest.mock("../mutations/common", () => ({
  requireAuthContext: jest.fn(),
}));

describe("circle standings queries", () => {
  const orgId = "org_circle_1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates circle-only standings, ranks by win rate, and keeps guests", async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([
        {
          playerId: "user-a",
          playerKind: "user",
          displayName: "alice",
          avatarUrl: null,
          gamesPlayed: 4,
          winCount: 3,
          lossCount: 1,
        },
        {
          playerId: "guest-b",
          playerKind: "guest",
          displayName: "Bob Guest",
          avatarUrl: null,
          gamesPlayed: 2,
          winCount: 1,
          lossCount: 1,
        },
        {
          playerId: "user-c",
          playerKind: "user",
          displayName: "carol",
          avatarUrl: "https://example.invalid/c.png",
          gamesPlayed: 1,
          winCount: 0,
          lossCount: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          playerId: "user-a",
          totalRounds: 10,
          totalBlitzes: 4,
          cumulativeScore: 40,
        },
        {
          playerId: "guest-b",
          totalRounds: 5,
          totalBlitzes: 1,
          cumulativeScore: -3,
        },
      ])
      .mockResolvedValueOnce([
        {
          playerAId: "guest-b",
          playerAName: "Bob Guest",
          playerBId: "user-a",
          playerBName: "alice",
          gamesPlayed: 2,
          aWins: 1,
          bWins: 1,
        },
      ]);

    const result = await getCircleStandingsForOrg(orgId);

    expect(result.organizationId).toBe(orgId);
    expect(result.standings.map((row) => row.playerId)).toEqual([
      "user-a",
      "guest-b",
      "user-c",
    ]);
    expect(result.standings[0]).toMatchObject({
      displayName: "alice",
      winRate: 75,
      battingAverage: "0.400",
      cumulativeScore: 40,
      playerKind: "user",
    });
    expect(result.standings[1]).toMatchObject({
      displayName: "Bob Guest",
      playerKind: "guest",
      battingAverage: "0.200",
      winRate: 50,
    });
    expect(result.standings[2]).toMatchObject({
      displayName: "carol",
      winRate: 0,
      battingAverage: "0.000",
      decidedGames: 0,
    });
    expect(result.headToHead).toEqual([
      {
        playerAId: "guest-b",
        playerAName: "Bob Guest",
        playerBId: "user-a",
        playerBName: "alice",
        gamesPlayed: 2,
        aWins: 1,
        bWins: 1,
      },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("requires an active circle for the authenticated entry point", async () => {
    (requireAuthContext as jest.Mock).mockResolvedValue({ orgId });
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getCircleStandings();

    expect(requireAuthContext).toHaveBeenCalledWith("org");
    expect(result).toEqual({
      organizationId: orgId,
      standings: [],
      headToHead: [],
    });
  });

  it("surfaces missing active circle from requireAuthContext", async () => {
    (requireAuthContext as jest.Mock).mockRejectedValue(
      new Error("No active circle"),
    );

    await expect(getCircleStandings()).rejects.toThrow("No active circle");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

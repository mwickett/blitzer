// Verifies the post-game summary is scheduled from BOTH finish paths:
// the direct "Finish" action and an edit that keeps a game finished.

const mockAuth = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));

const mockGameFindUnique = jest.fn();
const mockGameUpdate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockGuestFindUnique = jest.fn();
const mockScoreUpdateMany = jest.fn();
const mockTransaction = jest.fn();
jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: {
    game: {
      findUnique: (...a: unknown[]) => mockGameFindUnique(...a),
      update: (...a: unknown[]) => mockGameUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    guestUser: { findUnique: (...a: unknown[]) => mockGuestFindUnique(...a) },
    score: { updateMany: (...a: unknown[]) => mockScoreUpdateMany(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ capture: jest.fn() }),
}));

jest.mock("next/server", () => ({ after: (cb: () => unknown) => cb() }));

const mockSchedule = jest.fn().mockResolvedValue(undefined);
jest.mock("@/server/ai/summary", () => ({
  scheduleGameSummary: (...a: unknown[]) => mockSchedule(...a),
}));

jest.mock("@/server/email", () => ({
  __esModule: true,
  sendGameCompleteEmail: jest.fn().mockResolvedValue(undefined),
  EMAIL_INTER_SEND_DELAY_MS: 0,
}));

const mockGetGameById = jest.fn();
jest.mock("@/server/queries/games", () => ({
  __esModule: true,
  getGameById: (...a: unknown[]) => mockGetGameById(...a),
}));

import { updateGameAsFinished, updateRoundScores } from "@/server/mutations";

function finishedGame() {
  const player = (key: string, username: string) => ({
    id: `gp_${key}`,
    gameId: "game_1",
    userId: key,
    guestId: null,
    accentColor: null,
    user: { id: key, username },
    guestUser: null,
  });
  const score = (key: string, cards: number, blitz: number, ri: number) => ({
    id: `s_${ri}_${key}`,
    roundId: `r${ri + 1}`,
    userId: key,
    guestId: null,
    totalCardsPlayed: cards,
    blitzPileRemaining: blitz,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return {
    id: "game_1",
    winThreshold: 30,
    organizationId: "org_1",
    isFinished: true,
    winnerId: "u1", // u1 reaches 34 -> stays the winner
    createdAt: new Date(),
    endedAt: new Date(),
    players: [player("u1", "Mike"), player("u2", "Sarah")],
    rounds: [
      { id: "r1", gameId: "game_1", round: 1, createdAt: new Date(), scores: [score("u1", 20, 0, 0), score("u2", 14, 3, 0)] },
      { id: "r2", gameId: "game_1", round: 2, createdAt: new Date(), scores: [score("u1", 18, 2, 1), score("u2", 10, 0, 1)] },
    ],
  };
}

beforeEach(() => {
  mockAuth.mockReset().mockReturnValue({ userId: "clerk_1", orgId: "org_1" });
  mockGameFindUnique.mockReset();
  mockGameUpdate.mockReset().mockResolvedValue({});
  mockUserFindUnique.mockReset().mockResolvedValue({ username: "Mike" });
  mockGuestFindUnique.mockReset();
  mockScoreUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  mockTransaction.mockReset().mockImplementation((cb: (tx: unknown) => unknown) =>
    cb({ score: { updateMany: (...a: unknown[]) => mockScoreUpdateMany(...a) } })
  );
  mockSchedule.mockClear();
  mockGetGameById.mockReset();
});

describe("post-game summary wiring", () => {
  it("schedules a summary when a game is finished directly", async () => {
    mockGameFindUnique.mockResolvedValue({
      id: "game_1",
      organizationId: "org_1",
      isFinished: false,
      players: [],
    });

    await updateGameAsFinished("game_1", "u1", false);

    expect(mockSchedule).toHaveBeenCalledWith("game_1");
  });

  it("schedules a summary when a finished game's scores are edited", async () => {
    // requireGameInCircle lookup
    mockGameFindUnique.mockResolvedValue({
      id: "game_1",
      organizationId: "org_1",
    });
    // sync re-reads the full game via getGameById
    mockGetGameById.mockResolvedValue(finishedGame());

    await updateRoundScores("game_1", "r2", [
      { userId: "u1", blitzPileRemaining: 0, totalCardsPlayed: 18 },
      { userId: "u2", blitzPileRemaining: 5, totalCardsPlayed: 10 },
    ]);

    expect(mockSchedule).toHaveBeenCalledWith("game_1");
  });

  it("does not fail the finish when summary scheduling throws", async () => {
    mockGameFindUnique.mockResolvedValue({
      id: "game_1",
      organizationId: "org_1",
      isFinished: false,
      players: [],
    });
    mockSchedule.mockRejectedValueOnce(new Error("summary boom"));

    await expect(
      updateGameAsFinished("game_1", "u1", false)
    ).resolves.toBeUndefined();
  });
});

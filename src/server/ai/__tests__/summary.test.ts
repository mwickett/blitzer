const mockFindUnique = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockFindMany = jest.fn();
jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: {
    gameSummary: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      upsert: (...a: unknown[]) => mockUpsert(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));

const mockGetGameById = jest.fn();
jest.mock("@/server/queries/games", () => ({
  __esModule: true,
  getGameById: (...a: unknown[]) => mockGetGameById(...a),
}));

const mockGenerate = jest.fn();
jest.mock("@/server/ai/claude", () => ({
  __esModule: true,
  CLAUDE_SUMMARY_MODEL: "claude-opus-4-8",
  generateSummaryText: (...a: unknown[]) => mockGenerate(...a),
}));

const mockFlag = jest.fn();
jest.mock("@/featureFlags", () => ({
  __esModule: true,
  isLlmFeaturesEnabled: () => mockFlag(),
}));

const mockAfter = jest.fn((cb: () => unknown) => cb());
jest.mock("next/server", () => ({ after: (cb: () => unknown) => mockAfter(cb) }));

import {
  enqueueGameSummary,
  runGameSummary,
  scheduleGameSummary,
} from "@/server/ai/summary";
import { buildGameRecap } from "@/lib/insights/gameRecap";
import { hashRecapFacts } from "@/lib/insights/recapHash";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";

type ScoreInput = { key: string; cards: number; blitz: number };
function makeGame(
  winThreshold: number,
  names: Record<string, string>,
  roundsData: ScoreInput[][]
): GameWithPlayersAndScores {
  const players = Object.entries(names).map(([key, username]) => ({
    id: `gp_${key}`,
    gameId: "game_1",
    userId: key,
    guestId: null,
    accentColor: null,
    user: { id: key, username } as never,
    guestUser: null,
  }));
  const rounds = roundsData.map((scores, ri) => ({
    id: `r${ri + 1}`,
    gameId: "game_1",
    round: ri + 1,
    createdAt: new Date("2026-06-13T00:00:00Z"),
    scores: scores.map((s) => ({
      id: `s_${ri}_${s.key}`,
      roundId: `r${ri + 1}`,
      userId: s.key,
      guestId: null,
      totalCardsPlayed: s.cards,
      blitzPileRemaining: s.blitz,
      createdAt: new Date("2026-06-13T00:00:00Z"),
      updatedAt: new Date("2026-06-13T00:00:00Z"),
    })),
  }));
  return {
    id: "game_1",
    winThreshold,
    organizationId: "org_1",
    isFinished: true,
    createdAt: new Date("2026-06-13T00:00:00Z"),
    endedAt: new Date("2026-06-13T01:00:00Z"),
    winnerId: null,
    players,
    rounds,
  } as unknown as GameWithPlayersAndScores;
}

// u1 (Mike) wins 34-18 over u2 (Sarah), threshold 30, 2 rounds.
const readyGame = () =>
  makeGame(
    30,
    { u1: "Mike", u2: "Sarah" },
    [
      [
        { key: "u1", cards: 20, blitz: 0 },
        { key: "u2", cards: 14, blitz: 3 },
      ],
      [
        { key: "u1", cards: 18, blitz: 2 },
        { key: "u2", cards: 10, blitz: 0 },
      ],
    ]
  );

const readyHash = hashRecapFacts(buildGameRecap(readyGame()).facts);

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpsert.mockReset().mockResolvedValue({});
  mockUpdate.mockReset().mockResolvedValue({});
  mockFindMany.mockReset();
  mockGetGameById.mockReset();
  mockGenerate.mockReset();
  mockFlag.mockReset();
  mockAfter.mockClear();
});

describe("enqueueGameSummary", () => {
  it("upserts a pending row and reports enqueued for a fresh game", async () => {
    mockGetGameById.mockResolvedValue(readyGame());
    mockFindUnique.mockResolvedValue(null);

    const result = await enqueueGameSummary("game_1");

    expect(result).toEqual({ enqueued: true });
    const call = mockUpsert.mock.calls.at(-1)![0];
    expect(call.create.status).toBe("pending");
    expect(call.create.sourceStatsHash).toBe(readyHash);
  });

  it("skips when a ready summary already matches the hash", async () => {
    mockGetGameById.mockResolvedValue(readyGame());
    mockFindUnique.mockResolvedValue({
      status: "ready",
      sourceStatsHash: readyHash,
    });

    const result = await enqueueGameSummary("game_1");

    expect(result).toEqual({ enqueued: false });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("marks insufficient_data for a 1-round game", async () => {
    const g = readyGame();
    g.rounds = [g.rounds[0]];
    mockGetGameById.mockResolvedValue(g);
    mockFindUnique.mockResolvedValue(null);

    const result = await enqueueGameSummary("game_1");

    expect(result).toEqual({ enqueued: false });
    expect(mockUpsert.mock.calls.at(-1)![0].create.status).toBe(
      "insufficient_data"
    );
  });
});

describe("runGameSummary", () => {
  it("writes a ready summary with rehydrated real names", async () => {
    mockGetGameById.mockResolvedValue(readyGame());
    mockFindUnique.mockResolvedValue({ status: "pending", sourceStatsHash: readyHash });
    mockGenerate.mockResolvedValue({
      text: "Player A edged Player B.",
      tokensUsed: 42,
    });

    await runGameSummary("game_1");

    const ready = mockUpsert.mock.calls.find((c) => c[0].update.status === "ready");
    expect(ready).toBeDefined();
    expect(ready![0].update.content).toBe("Mike edged Sarah.");
    expect(ready![0].update.model).toBe("claude-opus-4-8");
    expect(ready![0].update.tokensUsed).toBe(42);
  });

  it("records failed status when the LLM throws", async () => {
    mockGetGameById.mockResolvedValue(readyGame());
    mockFindUnique.mockResolvedValue({ status: "pending", sourceStatsHash: readyHash });
    mockGenerate.mockRejectedValue(new Error("boom"));

    await runGameSummary("game_1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", error: "boom" }),
      })
    );
  });
});

describe("scheduleGameSummary", () => {
  it("does nothing when the llm-features flag is off", async () => {
    mockFlag.mockResolvedValue(false);

    await scheduleGameSummary("game_1");

    expect(mockGetGameById).not.toHaveBeenCalled();
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("enqueues and schedules the run when the flag is on", async () => {
    mockFlag.mockResolvedValue(true);
    mockGetGameById.mockResolvedValue(readyGame());
    mockFindUnique.mockResolvedValue(null);
    mockGenerate.mockResolvedValue({ text: "Player A wins.", tokensUsed: 5 });

    await scheduleGameSummary("game_1");

    expect(mockAfter).toHaveBeenCalledTimes(1);
  });
});

import prisma from "@/server/db/db";
import { getUserStatistics } from "../utils";
import { buildEnhancedSystemPrompt } from "../enhancedSystemPrompt";

jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() }, $queryRaw: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "internal-player" });
});

it("resolves the caller once and starts both bounded aggregates in parallel", async () => {
  const finish: Array<(rows: unknown[]) => void> = [];
  (prisma.$queryRaw as jest.Mock).mockImplementation(() => new Promise((resolve) => { finish.push(resolve); }));
  const pending = getUserStatistics("clerk-player");
  await Promise.resolve();
  expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { clerk_user_id: "clerk-player" }, select: { id: true } });
  expect(finish).toHaveLength(2);
  finish[0]([{ gamesCount: BigInt(1), completedGames: BigInt(1), winCount: BigInt(1), waitingLobbies: BigInt(1) }]);
  finish[1]([{ totalRounds: BigInt(2), totalBlitzes: BigInt(1) }]);
  const result = await pending;
  expect(result.games.winRate).toBe(100);
  expect(result.rounds.blitzPercentage).toBe(50);
  expect(() => JSON.stringify(result)).not.toThrow();
});

it("returns an empty context without scanning history for an unprovisioned caller", async () => {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
  const result = await getUserStatistics("clerk-missing");
  expect(result.games.gamesCount).toBe(0);
  expect(result.rounds.totalRounds).toBe(0);
  expect(prisma.$queryRaw).not.toHaveBeenCalled();
});

it("explains the completed-game denominator in the model context", async () => {
  (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ gamesCount: BigInt(2), completedGames: BigInt(1), winCount: BigInt(1), inProgressGames: BigInt(1) }]).mockResolvedValueOnce([]);
  const prompt = await buildEnhancedSystemPrompt("clerk-player", "Player");
  expect(prompt).toContain("Win rate among completed games with a recorded winner: 100.00%");
  expect(prompt).toContain("waiting lobbies and games in progress are excluded");
  expect(prompt).not.toContain("games won divided by games played");
});

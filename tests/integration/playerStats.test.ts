import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { EMPTY_GAME_STATS, EMPTY_ROUND_STATS, getGameStatsForUser, getRoundStatsForUser } from "../../src/server/queries/playerStats";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

test("statistics distinguish played games from lobbies and count losses to a guest winner", async () => {
  const player = await prisma.user.create({ data: {
    clerk_user_id: "stats-player", email: "stats-player@example.invalid", username: "stats-player",
  } });
  const guest = await prisma.guestUser.create({ data: { name: "Stats Guest", createdById: player.id } });
  const now = new Date("2026-09-05T12:00:00Z");
  const recent = new Date("2026-09-05T11:00:00Z");
  const old = new Date("2026-09-04T11:00:00Z");
  const createGame = (data: Record<string, unknown>) => prisma.game.create({ data: {
    kind: "PICKUP", createdAt: recent, startedAt: recent,
    players: { create: [{ userId: player.id }, { guestId: guest.id }] },
    ...data,
  } });
  const won = await createGame({ isFinished: true, winnerId: player.id });
  await createGame({ isFinished: true, winnerId: guest.id });
  await createGame({});
  await createGame({ endedAt: now });
  await createGame({ startedAt: null });
  await createGame({ startedAt: null, createdAt: old });
  await createGame({ isFinished: true }); // Historical completion without a recorded winner.
  await prisma.game.create({ data: { kind: "PICKUP", isFinished: true, winnerId: guest.id } });

  assert.deepEqual(await getGameStatsForUser(player.id, prisma, now), {
    gamesCount: 5, inProgressGames: 1, completedGames: 3, endedGames: 1,
    waitingLobbies: 1, expiredLobbies: 1, winCount: 1, lossCount: 1,
    decidedGames: 2, winRate: 50,
  });
  await prisma.round.create({ data: {
    gameId: won.id, round: 1, scores: { create: [
      { userId: player.id, totalCardsPlayed: 30, blitzPileRemaining: 0 },
      { guestId: guest.id, totalCardsPlayed: 12, blitzPileRemaining: 4 },
    ] },
  } });
  await prisma.round.create({ data: {
    gameId: won.id, round: 2, scores: { create: { userId: player.id, totalCardsPlayed: 4, blitzPileRemaining: 10 } },
  } });
  assert.deepEqual(await getRoundStatsForUser(player.id, prisma), {
    totalRounds: 2, totalBlitzes: 1, totalCardsPlayed: 34,
    avgCardsPlayed: 17, avgBlitzRemaining: 5, blitzPercentage: 50,
    highestScore: 30, lowestScore: -16, cumulativeScore: 14,
  });
  assert.deepEqual(await getGameStatsForUser("missing-player", prisma, now), EMPTY_GAME_STATS);
  assert.deepEqual(await getRoundStatsForUser("missing-player", prisma), EMPTY_ROUND_STATS);
});

test("one completed win plus a waiting lobby is a 100 percent win rate", async () => {
  const player = await prisma.user.create({ data: {
    clerk_user_id: "stats-single-win", email: "stats-single-win@example.invalid", username: "stats-single-win",
  } });
  await prisma.game.create({ data: { isFinished: true, winnerId: player.id, players: { create: { userId: player.id } } } });
  await prisma.game.create({ data: { kind: "PICKUP", startedAt: null, players: { create: { userId: player.id } } } });
  const stats = await getGameStatsForUser(player.id, prisma);
  assert.equal(stats.gamesCount, 1);
  assert.equal(stats.waitingLobbies, 1);
  assert.equal(stats.winRate, 100);
});

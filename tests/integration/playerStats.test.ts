import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { spread } from "../../src/lib/scoring/gameStats";
import { EMPTY_GAME_STATS, EMPTY_ROUND_STATS, getDeckStatsForUser, getGameStatsForUser, getRoundStatsForUser, getWidestGamesForUser } from "../../src/server/queries/playerStats";

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
  // A typed "Do math" total scores, but has no cards or Blitz pile to count.
  await prisma.round.create({ data: {
    gameId: won.id, round: 3, scores: { create: { userId: player.id, typedScore: 35 } },
  } });
  assert.deepEqual(await getRoundStatsForUser(player.id, prisma), {
    totalRounds: 3, breakdownRounds: 2, totalBlitzes: 1, totalCardsPlayed: 34,
    avgCardsPlayed: 17, avgBlitzRemaining: 5, blitzPercentage: 50,
    highestScore: 35, lowestScore: -16, cumulativeScore: 49,
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

test("deck win rates count only completed games with a winner", async () => {
  const player = await prisma.user.create({ data: {
    clerk_user_id: "stats-decks", email: "stats-decks@example.invalid", username: "stats-decks",
    preferredDeck: "pump",
  } });
  const guest = await prisma.guestUser.create({ data: { name: "Deck Guest", createdById: player.id } });
  const createGame = (deck: string | null, data: Record<string, unknown>) => prisma.game.create({ data: {
    kind: "PICKUP", startedAt: new Date("2026-09-05T11:00:00Z"),
    players: { create: [{ userId: player.id, deck }, { guestId: guest.id, deck: "pump" }] },
    ...data,
  } });
  await createGame("pump", { isFinished: true, winnerId: player.id });
  await createGame("pump", { isFinished: true, winnerId: guest.id });
  await createGame("carriage", { isFinished: true, winnerId: player.id });
  await createGame("carriage", {}); // In progress.
  await createGame("carriage", { isFinished: true }); // No recorded winner.
  await createGame("bucket", { isFinished: true, winnerId: player.id, startedAt: null });
  await createGame(null, { isFinished: true, winnerId: player.id });
  await createGame("anchor", { isFinished: true, winnerId: player.id }); // Not a known deck.

  assert.deepEqual(await getDeckStatsForUser(player.id, prisma), [
    { deck: "pump", games: 2, wins: 1, winRate: 50 },
    { deck: "carriage", games: 1, wins: 1, winRate: 100 },
  ]);
  assert.deepEqual(await getDeckStatsForUser("missing-player", prisma), []);
});

test("widest games and round compare the leader with the rest of the table", async () => {
  const player = await prisma.user.create({ data: {
    clerk_user_id: "stats-spread", email: "stats-spread@example.invalid", username: "stats-spread",
  } });
  const other = await prisma.user.create({ data: {
    clerk_user_id: "stats-spread-other", email: "stats-spread-other@example.invalid", username: "spread-other",
  } });
  const guest = await prisma.guestUser.create({ data: { name: "Spread Guest", createdById: player.id } });
  const startedAt = new Date("2026-09-05T11:00:00Z");
  const createGame = async (
    data: Record<string, unknown>,
    seats: Array<{ userId?: string; guestId?: string }>,
    rounds: Array<Array<{ userId?: string; guestId?: string; totalCardsPlayed?: number; blitzPileRemaining?: number; typedScore?: number }>>,
  ) => {
    const game = await prisma.game.create({ data: {
      kind: "PICKUP", startedAt, players: { create: seats }, ...data,
    } });
    for (const [index, scores] of rounds.entries()) {
      await prisma.round.create({ data: { gameId: game.id, round: index + 1, scores: { create: scores } } });
    }
    return game;
  };
  // Totals 30 and -5: a 35 point spread; round 1 alone is 20 against -5.
  const wide = await createGame(
    { isFinished: true, winnerId: player.id, endedAt: new Date("2026-09-05T12:00:00Z") },
    [{ userId: player.id }, { guestId: guest.id }],
    [
      [{ userId: player.id, totalCardsPlayed: 20, blitzPileRemaining: 0 }, { guestId: guest.id, totalCardsPlayed: 5, blitzPileRemaining: 5 }],
      [{ userId: player.id, typedScore: 10 }, { guestId: guest.id, typedScore: 0 }],
    ],
  );
  // The guest's 12 against the average of 10 and 0.
  const close = await createGame(
    { isFinished: true, winnerId: guest.id, endedAt: new Date("2026-09-06T12:00:00Z") },
    [{ userId: player.id }, { guestId: guest.id }, { userId: other.id }],
    [[{ userId: player.id, typedScore: 10 }, { guestId: guest.id, typedScore: 12 }, { userId: other.id, typedScore: 0 }]],
  );
  // Unfinished games and solo games never count.
  await createGame({}, [{ userId: player.id }, { guestId: guest.id }], [[{ userId: player.id, typedScore: 90 }, { guestId: guest.id, typedScore: -40 }]]);
  await createGame({ isFinished: true, winnerId: player.id }, [{ userId: player.id }], [[{ userId: player.id, typedScore: 75 }]]);

  assert.equal(spread([30, -5]), 35);
  assert.equal(spread([10, 12, 0]), 7);
  assert.deepEqual(await getWidestGamesForUser(player.id, prisma), {
    games: [
      { gameId: wide.id, finishedAt: "2026-09-05T12:00:00.000Z", spread: 35, leaderName: "stats-spread", leaderIsMe: true },
      { gameId: close.id, finishedAt: "2026-09-06T12:00:00.000Z", spread: 7, leaderName: "Spread Guest", leaderIsMe: false },
    ],
    round: { gameId: wide.id, finishedAt: "2026-09-05T12:00:00.000Z", spread: 25, leaderName: "stats-spread", leaderIsMe: true, roundNumber: 1 },
  });
  assert.deepEqual(await getWidestGamesForUser("missing-player", prisma), { games: [], round: null });
});

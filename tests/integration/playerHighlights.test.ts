import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { EMPTY_HIGHLIGHTS, getPlayerHighlightsForUser } from "../../src/server/queries/playerHighlights";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

type Seat = { userId?: string; guestId?: string };
type Hand = [cards: number, blitzRemaining: number];

async function playGame(seats: Seat[], rounds: Hand[][], winner: Seat | null, endedAt: string) {
  const game = await prisma.game.create({ data: {
    kind: "PICKUP", isFinished: true, endedAt: new Date(endedAt),
    winnerId: winner ? winner.userId ?? winner.guestId : null,
    players: { create: seats },
  } });
  for (const [index, hands] of rounds.entries()) {
    await prisma.round.create({ data: { gameId: game.id, round: index + 1, scores: { create: hands.map(
      ([totalCardsPlayed, blitzPileRemaining], seat) => ({ ...seats[seat], totalCardsPlayed, blitzPileRemaining }),
    ) } } });
  }
  return game.id;
}

test("highlights find rivals, comebacks, close finishes and blitz streaks", async () => {
  const player = await prisma.user.create({ data: {
    clerk_user_id: "highlights-player", email: "highlights-player@example.invalid", username: "highlights-player",
  } });
  const rival = await prisma.user.create({ data: {
    clerk_user_id: "highlights-rival", email: "highlights-rival@example.invalid", username: "Aunt Carol",
  } });
  const guest = await prisma.guestUser.create({ data: { name: "Cousin Sam", createdById: player.id } });
  const me = { userId: player.id };
  const carol = { userId: rival.id };
  const sam = { guestId: guest.id };

  // Oldest: a blowout win over Sam with three straight blitzes.
  const blowout = await playGame([me, sam], [[[30, 0], [5, 6]], [[30, 0], [5, 6]], [[30, 0], [5, 6]]], me, "2026-09-01T12:00:00Z");
  // Carol leads by 30 after round one, then the player storms back to win by 4.
  const comeback = await playGame([me, carol], [[[0, 10], [10, 0]], [[40, 0], [6, 0]], [[40, 0], [40, 0]]], me, "2026-09-02T12:00:00Z");
  // Two losses to Carol, one by a single point.
  const heartbreaker = await playGame([me, carol], [[[20, 0], [21, 0]]], carol, "2026-09-03T12:00:00Z");
  await playGame([me, carol, sam], [[[5, 0], [40, 0], [6, 0]]], carol, "2026-09-04T12:00:00Z");
  // Completed without a recorded winner: counts as sampled, not as a result.
  await playGame([me, carol], [[[10, 0], [10, 0]]], null, "2026-09-05T12:00:00Z");
  // A game the player never sat in must not affect anything.
  await playGame([carol, sam], [[[0, 10], [40, 0]]], sam, "2026-09-06T12:00:00Z");

  const highlights = await getPlayerHighlightsForUser(player.id, prisma);
  assert.equal(highlights.sampledGames, 5);
  assert.deepEqual(highlights.recentResults, ["L", "L", "W", "W"]);
  assert.deepEqual(highlights.currentStreak, { result: "L", length: 2 });
  assert.equal(highlights.longestWinStreak, 2);
  assert.deepEqual(highlights.rivals.mostPlayed, { name: "Aunt Carol", gamesPlayed: 4, wins: 1, losses: 2 });
  assert.deepEqual(highlights.rivals.nemesis, highlights.rivals.mostPlayed);
  assert.deepEqual(highlights.rivals.favoriteOpponent, { name: "Cousin Sam", gamesPlayed: 2, wins: 1, losses: 0 });
  assert.equal(highlights.biggestComeback?.gameId, comeback);
  assert.equal(highlights.biggestComeback?.maxDeficit, 30);
  assert.equal(highlights.closestWin?.gameId, comeback);
  assert.equal(highlights.closestWin?.finalMargin, 4);
  assert.equal(highlights.biggestWin?.gameId, blowout);
  assert.equal(highlights.biggestWin?.finalMargin, 111);
  assert.equal(highlights.heartbreaker?.gameId, heartbreaker);
  assert.equal(highlights.heartbreaker?.finalMargin, -1);
  assert.deepEqual(highlights.blitzStreak, { gameId: blowout, rounds: 3 });

  assert.deepEqual(await getPlayerHighlightsForUser("missing-player", prisma), EMPTY_HIGHLIGHTS);
});

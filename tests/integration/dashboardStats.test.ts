import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  getRecentGamesForUser,
  getRivalsForUser,
  getWinStreaksForUser,
} from "../../src/server/queries/playerStats";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

test("dashboard recent games, streaks, and rivals come from completed games", async () => {
  const user = (name: string) => prisma.user.create({ data: {
    clerk_user_id: `dash-${name}`, email: `dash-${name}@example.invalid`, username: `dash-${name}`,
  } });
  const me = await user("me");
  const dad = await user("dad");
  const stranger = await user("stranger");
  const grandma = await prisma.guestUser.create({ data: { name: "Grandma", createdById: me.id } });

  type Seat = { userId?: string; guestId?: string; cards: number; left: number };
  let day = 1;
  const playGame = async (winnerId: string | null, seats: Seat[], data: Record<string, unknown> = {}) => {
    const endedAt = new Date(`2026-09-${String(day++).padStart(2, "0")}T12:00:00Z`);
    return prisma.game.create({ data: {
      kind: "PICKUP", isFinished: true, winnerId, endedAt, startedAt: endedAt, createdAt: endedAt,
      players: { create: seats.map(({ userId, guestId }) => ({ userId, guestId })) },
      rounds: { create: { round: 1, scores: { create: seats.map(({ userId, guestId, cards, left }) => ({
        userId, guestId, totalCardsPlayed: cards, blitzPileRemaining: left,
      })) } } },
      ...data,
    } });
  };

  // Oldest to newest: W W L W W W, plus an undecided finished game.
  await playGame(me.id, [{ userId: me.id, cards: 30, left: 0 }, { userId: dad.id, cards: 10, left: 2 }]);
  await playGame(me.id, [{ userId: me.id, cards: 25, left: 0 }, { guestId: grandma.id, cards: 12, left: 1 }]);
  await playGame(dad.id, [{ userId: me.id, cards: 5, left: 4 }, { userId: dad.id, cards: 28, left: 0 }, { guestId: grandma.id, cards: 20, left: 0 }]);
  await playGame(me.id, [{ userId: me.id, cards: 22, left: 0 }, { userId: dad.id, cards: 9, left: 3 }]);
  await playGame(me.id, [{ userId: me.id, cards: 19, left: 0 }, { userId: dad.id, cards: 18, left: 1 }]);
  const latestWin = await playGame(me.id, [{ userId: me.id, cards: 40, left: 0 }, { guestId: grandma.id, cards: 4, left: 6 }]);
  const undecided = await playGame(null, [{ userId: me.id, cards: 10, left: 0 }, { userId: dad.id, cards: 11, left: 0 }]);
  // Neither unfinished games nor games without me count.
  await playGame(me.id, [{ userId: me.id, cards: 50, left: 0 }, { userId: dad.id, cards: 1, left: 9 }], { isFinished: false });
  await playGame(stranger.id, [{ userId: stranger.id, cards: 30, left: 0 }, { userId: dad.id, cards: 1, left: 9 }]);

  const recent = await getRecentGamesForUser(me.id, prisma, 3);
  assert.deepEqual(recent.map(({ id, won, score, place, playerCount, roundCount }) => ({ id, won, score, place, playerCount, roundCount })), [
    { id: undecided.id, won: null, score: 10, place: 2, playerCount: 2, roundCount: 1 },
    { id: latestWin.id, won: true, score: 40, place: 1, playerCount: 2, roundCount: 1 },
    { id: recent[2].id, won: true, score: 19, place: 1, playerCount: 2, roundCount: 1 },
  ]);
  const all = await getRecentGamesForUser(me.id, prisma);
  assert.equal(all.length, 7);
  // 5 cards with 4 left in Blitz scores 5 - 4 * 2 = -3, behind both opponents.
  const loss = all.find((game) => game.won === false);
  assert.deepEqual(loss && { score: loss.score, place: loss.place, playerCount: loss.playerCount }, { score: -3, place: 3, playerCount: 3 });

  assert.deepEqual(await getWinStreaksForUser(me.id, prisma), { current: { kind: "win", length: 3 }, bestWin: 3 });
  assert.deepEqual(await getWinStreaksForUser(dad.id, prisma), { current: { kind: "loss", length: 3 }, bestWin: 1 });
  assert.deepEqual(await getWinStreaksForUser(stranger.id + "-missing", prisma), { current: null, bestWin: 0 });

  assert.deepEqual(await getRivalsForUser(me.id, prisma), [
    { playerId: dad.id, kind: "user", name: "dash-dad", avatarUrl: null, gamesTogether: 4, myWins: 3, theirWins: 1 },
    { playerId: grandma.id, kind: "guest", name: "Grandma", avatarUrl: null, gamesTogether: 3, myWins: 2, theirWins: 0 },
  ]);
  assert.deepEqual(await getRivalsForUser(me.id, prisma, 1), [
    { playerId: dad.id, kind: "user", name: "dash-dad", avatarUrl: null, gamesTogether: 4, myWins: 3, theirWins: 1 },
  ]);
});

test("a saved dashboard layout round-trips through the User row", async () => {
  const user = await prisma.user.create({ data: {
    clerk_user_id: "dash-layout", email: "dash-layout@example.invalid", username: "dash-layout",
  } });
  assert.equal(user.dashboardLayout, null);
  const layout = { order: ["rivals", "record"], hidden: ["record"] };
  const updated = await prisma.user.update({ where: { id: user.id }, data: { dashboardLayout: layout } });
  assert.deepEqual(updated.dashboardLayout, layout);
});

import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  getBadgeGamesForUser,
  getBadgesForUser,
} from "../../src/server/queries/badges";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
after(() => prisma.$disconnect());

test("badge history loads finished games with per-round scores and blitz piles", async () => {
  const ana = await prisma.user.create({
    data: { clerk_user_id: "badges-ana", email: "badges-ana@example.invalid", username: "badges-ana" },
  });
  const ben = await prisma.user.create({
    data: { clerk_user_id: "badges-ben", email: "badges-ben@example.invalid", username: "badges-ben" },
  });
  const guest = await prisma.guestUser.create({ data: { name: "Badge Guest", createdById: ana.id } });
  const seats = [{ userId: ana.id }, { userId: ben.id }, { guestId: guest.id }];

  const finished = await prisma.game.create({
    data: {
      kind: "PICKUP",
      isFinished: true,
      winnerId: ana.id,
      endedAt: new Date("2026-05-01T00:00:00Z"),
      players: { create: seats },
      rounds: {
        create: [
          {
            round: 1,
            scores: {
              create: [
                { userId: ana.id, totalCardsPlayed: 30, blitzPileRemaining: 0 },
                { userId: ben.id, totalCardsPlayed: 10, blitzPileRemaining: 2 },
                // The guest's round was typed as a total.
                { guestId: guest.id, typedScore: -4 },
              ],
            },
          },
          {
            round: 2,
            scores: {
              create: [
                { userId: ana.id, totalCardsPlayed: 30, blitzPileRemaining: 0 },
                { userId: ben.id, totalCardsPlayed: 12, blitzPileRemaining: 1 },
                { guestId: guest.id, totalCardsPlayed: 3, blitzPileRemaining: 5 },
              ],
            },
          },
          {
            round: 3,
            scores: {
              create: [
                { userId: ana.id, totalCardsPlayed: 20, blitzPileRemaining: 0 },
                { userId: ben.id, totalCardsPlayed: 5, blitzPileRemaining: 4 },
                { guestId: guest.id, totalCardsPlayed: 2, blitzPileRemaining: 6 },
              ],
            },
          },
        ],
      },
    },
  });
  // In progress games never count.
  await prisma.game.create({
    data: {
      kind: "PICKUP",
      players: { create: seats.slice(0, 2) },
      rounds: {
        create: {
          round: 1,
          scores: {
            create: [
              { userId: ana.id, totalCardsPlayed: 30, blitzPileRemaining: 0 },
              { userId: ben.id, totalCardsPlayed: 10, blitzPileRemaining: 2 },
            ],
          },
        },
      },
    },
  });

  const games = await getBadgeGamesForUser(ana.id, prisma);
  assert.equal(games.length, 1);
  const [game] = games;
  assert.equal(game.gameId, finished.id);
  assert.equal(game.winnerId, ana.id);
  assert.equal(game.finishedAt, "2026-05-01T00:00:00.000Z");
  assert.deepEqual(game.scoresByRound[ana.id], [30, 60, 80]);
  assert.deepEqual(game.deltasByRound[ben.id], [6, 10, -3]);
  assert.deepEqual(game.blitzByRound[guest.id], [null, 5, 6]);
  assert.deepEqual(game.scoresByRound[guest.id], [-4, -11, -21]);
  assert.deepEqual(
    game.players.map((p) => p.name).sort(),
    ["Badge Guest", "badges-ana", "badges-ben"],
  );

  const badges = Object.fromEntries(
    (await getBadgesForUser(ana.id, prisma)).map((p) => [p.badge.id, p.count]),
  );
  assert.equal(badges.first_win, 1);
  assert.equal(badges.first_blitz, 1);
  assert.equal(badges.triple_blitz, 1);
  assert.equal(badges.short_fuse, 1);
  assert.equal(badges.wire_to_wire, 1);
  assert.equal(badges.tornado, 0);
});

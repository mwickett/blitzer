import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { getCircleStandingsForOrg } from "../../src/server/queries/circleStandings";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
after(() => prisma.$disconnect());

test("circle standings include guests, exclude pickup, and build head-to-head", async () => {
  const orgId = "org_standings_test";
  const otherOrg = "org_other_circle";
  const alice = await prisma.user.create({
    data: {
      clerk_user_id: "standings-alice",
      email: "standings-alice@example.invalid",
      username: "standings-alice",
    },
  });
  const carol = await prisma.user.create({
    data: {
      clerk_user_id: "standings-carol",
      email: "standings-carol@example.invalid",
      username: "standings-carol",
    },
  });
  const guest = await prisma.guestUser.create({
    data: {
      name: "Standings Guest",
      createdById: alice.id,
      organizationId: orgId,
    },
  });

  const circleWin = await prisma.game.create({
    data: {
      kind: "CIRCLE",
      organizationId: orgId,
      isFinished: true,
      winnerId: alice.id,
      players: {
        create: [
          { userId: alice.id },
          { guestId: guest.id },
          { userId: carol.id },
        ],
      },
      rounds: {
        create: {
          round: 1,
          scores: {
            create: [
              { userId: alice.id, totalCardsPlayed: 20, blitzPileRemaining: 0 },
              { guestId: guest.id, totalCardsPlayed: 8, blitzPileRemaining: 4 },
              { userId: carol.id, totalCardsPlayed: 10, blitzPileRemaining: 2 },
            ],
          },
        },
      },
    },
  });
  await prisma.game.create({
    data: {
      kind: "CIRCLE",
      organizationId: orgId,
      isFinished: true,
      winnerId: guest.id,
      players: {
        create: [{ userId: alice.id }, { guestId: guest.id }],
      },
      rounds: {
        create: {
          round: 1,
          scores: {
            create: [
              { userId: alice.id, totalCardsPlayed: 6, blitzPileRemaining: 3 },
              {
                guestId: guest.id,
                totalCardsPlayed: 18,
                blitzPileRemaining: 0,
              },
            ],
          },
        },
      },
    },
  });
  // In-progress circle game counts toward games played but not W-L.
  await prisma.game.create({
    data: {
      kind: "CIRCLE",
      organizationId: orgId,
      players: { create: [{ userId: carol.id }, { userId: alice.id }] },
    },
  });
  // Pickup and other-circle games must not affect this standings board.
  await prisma.game.create({
    data: {
      kind: "PICKUP",
      isFinished: true,
      winnerId: alice.id,
      players: { create: [{ userId: alice.id }, { userId: carol.id }] },
    },
  });
  await prisma.game.create({
    data: {
      kind: "CIRCLE",
      organizationId: otherOrg,
      isFinished: true,
      winnerId: carol.id,
      players: { create: [{ userId: carol.id }, { userId: alice.id }] },
    },
  });

  const result = await getCircleStandingsForOrg(orgId, prisma);

  assert.equal(result.organizationId, orgId);
  // Same win rate → more games played ranks higher (alice before guest).
  assert.deepEqual(
    result.standings.map((row) => row.playerId),
    [alice.id, guest.id, carol.id],
  );
  assert.equal(result.standings[0].playerId, alice.id);
  assert.equal(result.standings[0].winCount, 1);
  assert.equal(result.standings[0].lossCount, 1);
  assert.equal(result.standings[0].gamesPlayed, 3);
  assert.equal(result.standings[0].battingAverage, "0.500");
  assert.equal(result.standings[0].cumulativeScore, 20);
  assert.deepEqual(result.standings[1], {
    playerId: guest.id,
    playerKind: "guest",
    displayName: "Standings Guest",
    avatarUrl: null,
    gamesPlayed: 2,
    winCount: 1,
    lossCount: 1,
    decidedGames: 2,
    winRate: 50,
    totalRounds: 2,
    totalBlitzes: 1,
    battingAverage: "0.500",
    cumulativeScore: 18, // (8 - 8) + 18
  });
  assert.equal(result.standings[2].playerId, carol.id);
  assert.equal(result.standings[2].gamesPlayed, 2);
  assert.equal(result.standings[2].decidedGames, 1);
  assert.equal(result.standings[2].lossCount, 1);
  assert.equal(result.standings[2].winRate, 0);

  const aliceGuest = result.headToHead.find(
    (pair) =>
      (pair.playerAId === alice.id && pair.playerBId === guest.id) ||
      (pair.playerAId === guest.id && pair.playerBId === alice.id),
  );
  assert.ok(aliceGuest);
  assert.equal(aliceGuest.gamesPlayed, 2);
  assert.equal(aliceGuest.aWins + aliceGuest.bWins, 2);

  // Sanity: the finished circle win still exists for cleanup assertions.
  assert.equal(circleWin.organizationId, orgId);
});

test("empty circle returns empty standings", async () => {
  const result = await getCircleStandingsForOrg("org_empty_standings", prisma);
  assert.deepEqual(result, {
    organizationId: "org_empty_standings",
    standings: [],
    headToHead: [],
  });
});

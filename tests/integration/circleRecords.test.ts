import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { getCircleRecordsForOrg } from "../../src/server/queries/circleRecords";

assert.equal(
  process.env.BLITZER_INTEGRATION_TEST,
  "1",
  "Use npm run test:integration",
);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
after(() => prisma.$disconnect());

type Line = [cards: number, blitzPile: number];

async function createGame(
  orgId: string,
  kind: "CIRCLE" | "PICKUP",
  players: { userId?: string; guestId?: string }[],
  rounds: Line[][],
  { winnerId, endedAt }: { winnerId?: string; endedAt?: Date } = {},
) {
  // Rounds are spaced an hour apart, ending when the game ended.
  const end = (endedAt ?? new Date("2026-06-01T00:00:00Z")).getTime();
  return prisma.game.create({
    data: {
      kind,
      organizationId: kind === "CIRCLE" ? orgId : null,
      isFinished: !!winnerId,
      winnerId: winnerId ?? null,
      endedAt: endedAt ?? null,
      players: { create: players },
      rounds: {
        create: rounds.map((lines, index) => ({
          round: index + 1,
          createdAt: new Date(end - (rounds.length - index) * 3_600_000),
          scores: {
            create: lines.map(([cards, blitzPile], seat) => ({
              ...players[seat],
              totalCardsPlayed: cards,
              blitzPileRemaining: blitzPile,
            })),
          },
        })),
      },
    },
  });
}

test("circle records find each all-time best, first setter keeps ties", async () => {
  const orgId = "org_records_test";
  const ana = await prisma.user.create({
    data: {
      clerk_user_id: "records-ana",
      email: "records-ana@example.invalid",
      username: "records-ana",
    },
  });
  const ben = await prisma.user.create({
    data: {
      clerk_user_id: "records-ben",
      email: "records-ben@example.invalid",
      username: "records-ben",
    },
  });
  const guest = await prisma.guestUser.create({
    data: { name: "Records Guest", createdById: ana.id, organizationId: orgId },
  });
  const seats = [{ userId: ana.id }, { userId: ben.id }, { guestId: guest.id }];

  // Ben trails by 30 after round 1, then comes back to win in round 3.
  const comeback = await createGame(
    orgId,
    "CIRCLE",
    seats,
    [
      [
        [30, 0],
        [0, 0],
        [5, 3],
      ],
      [
        [0, 10],
        [25, 0],
        [4, 2],
      ],
      [
        [2, 0],
        [40, 0],
        [3, 3],
      ],
    ],
    { winnerId: ben.id, endedAt: new Date("2026-02-01T00:00:00Z") },
  );
  // Ana wins in two rounds and ties the highest round (30) later, which
  // must not take the record from the earlier game.
  const quick = await createGame(
    orgId,
    "CIRCLE",
    seats.slice(0, 2),
    [
      [
        [30, 0],
        [5, 1],
      ],
      [
        [20, 0],
        [6, 2],
      ],
    ],
    { winnerId: ana.id, endedAt: new Date("2026-03-01T00:00:00Z") },
  );
  // Games in progress, pickup games and other Circles never count.
  await createGame(orgId, "CIRCLE", seats.slice(0, 2), [
    [
      [55, 0],
      [0, 15],
    ],
  ]);
  await createGame(
    orgId,
    "PICKUP",
    seats.slice(0, 2),
    [
      [
        [60, 0],
        [0, 10],
      ],
    ],
    {
      winnerId: ana.id,
    },
  );
  await createGame(
    "org_records_other",
    "CIRCLE",
    seats.slice(0, 2),
    [
      [
        [70, 0],
        [0, 10],
      ],
    ],
    { winnerId: ana.id },
  );

  const records = await getCircleRecordsForOrg(orgId);
  const byKind = Object.fromEntries(records.map((r) => [r.kind, r]));

  assert.deepEqual(
    records.map((r) => r.kind),
    [
      "highestRound",
      "lowestRound",
      "mostBlitzes",
      "biggestComeback",
      "longestGame",
      "fastestWin",
    ],
  );
  assert.equal(byKind.highestRound.value, 40);
  assert.equal(byKind.highestRound.playerName, "records-ben");
  assert.equal(byKind.highestRound.roundNumber, 3);
  assert.equal(byKind.lowestRound.value, -20);
  assert.equal(byKind.lowestRound.playerName, "records-ana");
  assert.equal(byKind.lowestRound.gameId, comeback.id);
  assert.equal(byKind.mostBlitzes.value, 3);
  assert.equal(byKind.mostBlitzes.playerName, "records-ben");
  assert.equal(byKind.biggestComeback.value, 30);
  assert.equal(byKind.biggestComeback.playerName, "records-ben");
  assert.equal(byKind.longestGame.value, 3);
  assert.equal(byKind.longestGame.playerName, null);
  assert.equal(byKind.fastestWin.value, 2);
  assert.equal(byKind.fastestWin.gameId, quick.id);
  assert.equal(byKind.fastestWin.playerName, "records-ana");

  // A tie keeps the first game: add a later 40-point round.
  await createGame(
    orgId,
    "CIRCLE",
    seats.slice(0, 2),
    [
      [
        [40, 0],
        [1, 1],
      ],
      [
        [40, 0],
        [1, 1],
      ],
    ],
    { winnerId: ana.id, endedAt: new Date("2026-04-01T00:00:00Z") },
  );
  const after = await getCircleRecordsForOrg(orgId);
  const highest = after.find((r) => r.kind === "highestRound")!;
  assert.equal(highest.gameId, comeback.id);
});

test("circle records are empty for a circle with no games", async () => {
  assert.deepEqual(await getCircleRecordsForOrg("org_records_empty"), []);
});

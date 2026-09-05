import assert from "node:assert/strict";
import { after, test } from "node:test";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { seedGameData, seedId } from "../../prisma/fixtures";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

test("seeding twice preserves edited rounds, new rounds, and rematches sharing fixture guests", async () => {
  const users = await Promise.all([1, 2, 3].map(async (n) => {
    const user = await prisma.user.create({ data: {
      clerk_user_id: `seed-test-${n}`, email: `seed-test-${n}@example.invalid`, username: `seed-test-${n}`,
    } });
    return { clerkId: user.clerk_user_id, prismaId: user.id, username: user.username };
  }));
  const config = {
    orgA: "seed-test-org-a", orgB: "seed-test-org-b", orgC: "seed-test-org-c",
    anchorUserId: users[0].clerkId, user2Id: users[1].clerkId, user3Id: users[2].clerkId,
    prodDbHost: "production.example.invalid",
  };
  await seedGameData(prisma, config, users);
  const gameId = seedId(2, 3);
  const initialCount = await prisma.game.count();
  await prisma.score.update({ where: { id: seedId(5, 1) }, data: { totalCardsPlayed: 27 } });
  const added = await prisma.round.create({ data: {
    gameId, round: 3, scores: { create: {
      userId: users[0].prismaId, totalCardsPlayed: 30, blitzPileRemaining: 0,
    } },
  }, include: { scores: true } });
  const rematch = await prisma.game.create({ data: {
    organizationId: config.orgA, players: { create: [
      { userId: users[0].prismaId }, { guestId: seedId(1, 1) },
    ] },
  }, include: { players: true } });
  await prisma.guestUser.update({ where: { id: seedId(1, 1) }, data: { name: "Renamed fixture guest" } });
  await Promise.all([seedGameData(prisma, config, users), seedGameData(prisma, config, users)]);
  assert.equal(await prisma.game.count(), initialCount + 1);
  assert.deepEqual(await prisma.round.findUnique({ where: { id: added.id }, include: { scores: true } }), added);
  assert.deepEqual(await prisma.game.findUnique({ where: { id: rematch.id }, include: { players: true } }), rematch);
  assert.equal((await prisma.score.findUniqueOrThrow({ where: { id: seedId(5, 1) } })).totalCardsPlayed, 27);
  assert.equal((await prisma.guestUser.findUniqueOrThrow({ where: { id: seedId(1, 1) } })).name, "Renamed fixture guest");
});

test("production skips before requiring preview configuration or credentials", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, NODE_ENV: "production", VERCEL_ENV: "production" },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skipping seed in production/);
});

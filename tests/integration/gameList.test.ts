import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { getGameListPageForViewer } from "../../src/server/queries/gameList";
import {
  GAME_LIST_PAGE_SIZE,
  GAME_PLAYER_OPTION_LIMIT,
} from "../../src/lib/gameList";

assert.equal(
  process.env.BLITZER_INTEGRATION_TEST,
  "1",
  "Use npm run test:integration",
);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
after(() => prisma.$disconnect());

test("game pages preserve circle/pickup scope, stable cursors, minimal DTOs, and started times", async (context) => {
  const [player, outsider] = await Promise.all(
    ["viewer", "outsider"].map((name) =>
      prisma.user.create({
        data: {
          clerk_user_id: `list-${name}`,
          username: `list-${name}`,
          email: `private-${name}@example.invalid`,
        },
      }),
    ),
  );
  const guest = await prisma.guestUser.create({
    data: {
      name: "List guest",
      createdById: player.id,
      emailSent: "private-guest@example.invalid",
      invitationSent: true,
    },
  });
  const createdAt = new Date("2026-09-05T01:00:00Z");
  const startedAt = new Date("2026-09-05T04:00:00Z");
  const visible = await Promise.all(
    Array.from({ length: 25 }, () =>
      prisma.game.create({
        data: {
          kind: "CIRCLE",
          organizationId: "list-circle",
          createdAt,
          startedAt,
          players: { create: [{ userId: player.id }, { guestId: guest.id }] },
        },
      }),
    ),
  );
  const pickup = await prisma.game.create({
    data: {
      kind: "PICKUP",
      createdAt,
      startedAt,
      joinToken: "private-token",
      joinCode: "private-code",
      players: { create: { userId: player.id } },
    },
  });
  visible.push(pickup);
  await prisma.game.create({
    data: {
      kind: "CIRCLE",
      organizationId: "other-list-circle",
      players: { create: { userId: player.id } },
    },
  });
  await prisma.game.create({
    data: { kind: "PICKUP", players: { create: { userId: outsider.id } } },
  });
  const legacy = await prisma.game.create({
    data: { kind: "LEGACY", players: { create: { userId: player.id } } },
  });
  await prisma.round.create({
    data: {
      gameId: pickup.id,
      round: 1,
      scores: {
        create: {
          userId: player.id,
          totalCardsPlayed: 10,
          blitzPileRemaining: 0,
        },
      },
    },
  });
  const viewer = { userId: player.clerk_user_id, orgId: "list-circle" };
  const first = await getGameListPageForViewer(viewer, {}, "current", prisma);
  assert.equal(first.games.length, GAME_LIST_PAGE_SIZE);
  assert.equal(first.totalMatches, 26);
  assert.equal(first.legacyCount, 1);
  assert.ok(first.nextCursor);
  const second = await getGameListPageForViewer(
    viewer,
    { cursor: first.nextCursor },
    "current",
    prisma,
  );
  assert.equal(second.games.length, 6);
  assert.equal(second.nextCursor, null);
  const all = [...first.games, ...second.games];
  assert.deepEqual(
    all.map((game) => game.id),
    visible
      .map((game) => game.id)
      .sort()
      .reverse(),
  );
  assert.equal(new Set(all.map((game) => game.id)).size, 26);
  assert.equal(all.find((game) => game.id === pickup.id)?.roundCount, 1);
  assert.equal(all[0].startedAt, startedAt.toISOString());
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(
    serialized,
    /private-|clerk_user_id|email|invitation|joinToken|joinCode|scores/,
  );
  assert.deepEqual(JSON.parse(serialized), first);
  const oldPayload = await prisma.game.findMany({
    where: {
      OR: [
        { kind: "CIRCLE", organizationId: viewer.orgId },
        {
          kind: "PICKUP",
          players: { some: { user: { clerk_user_id: viewer.userId } } },
        },
      ],
    },
    include: {
      players: { include: { user: true, guestUser: true } },
      rounds: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const oldBytes = Buffer.byteLength(JSON.stringify(oldPayload));
  const newBytes = Buffer.byteLength(serialized);
  assert.ok(newBytes < oldBytes);
  context.diagnostic(
    `Same synthetic history: old query returned ${oldPayload.length} games / ${oldBytes} serialized bytes; new page returned ${first.games.length} of ${first.totalMatches} games / ${newBytes} bytes, including filter options and counts.`,
  );

  // The runner owns this disposable database. Reapply the exact additive
  // migration after fixtures exist, then verify their rows are preserved.
  await prisma.$executeRawUnsafe('DROP INDEX "Game_created_at_id_idx"');
  const migration = await readFile(
    new URL(
      "../../src/server/db/migrations/20260905020000_game_list_cursor_index/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await prisma.$executeRawUnsafe(migration);
  assert.equal(
    await prisma.game.count({
      where: { id: { in: visible.map((game) => game.id) } },
    }),
    visible.length,
  );
  assert.deepEqual(
    (
      await getGameListPageForViewer(
        { userId: player.clerk_user_id },
        {},
        "current",
        prisma,
      )
    ).games.map((game) => game.id),
    [pickup.id],
  );
  assert.deepEqual(
    (await getGameListPageForViewer(viewer, {}, "legacy", prisma)).games.map(
      (game) => game.id,
    ),
    [legacy.id],
  );
  assert.deepEqual(
    (
      await getGameListPageForViewer(
        viewer,
        { cursor: "invalid" },
        "current",
        prisma,
      )
    ).games,
    first.games,
  );
});

test("status filters distinguish waiting and expired lobbies and apply before pagination", async () => {
  const player = await prisma.user.create({
    data: {
      clerk_user_id: "list-status",
      username: "list-status",
      email: "list-status@example.invalid",
    },
  });
  const now = new Date("2026-09-05T12:00:00Z");
  const create = (data: Record<string, unknown>) =>
    prisma.game.create({
      data: {
        kind: "PICKUP",
        createdAt: now,
        players: { create: { userId: player.id } },
        ...data,
      },
    });
  const waiting = await create({ startedAt: null });
  const expired = await create({
    startedAt: null,
    createdAt: new Date("2026-09-04"),
  });
  const completed = await create({ isFinished: true, winnerId: player.id });
  const ended = await create({ endedAt: now });
  const active = await create({});
  for (const [status, game] of Object.entries({
    lobby: waiting,
    expired,
    completed,
    ended,
    active,
  })) {
    const page = await getGameListPageForViewer(
      { userId: player.clerk_user_id },
      { status },
      "current",
      prisma,
      now,
    );
    assert.deepEqual(
      page.games.map((row) => row.id),
      [game.id],
    );
    assert.equal(page.games[0].status, status);
    if (status === "lobby" || status === "expired")
      assert.equal(page.games[0].startedAt, null);
  }
});

test("bounded player options search all visible games and filters require every selected player", async () => {
  const player = await prisma.user.create({
    data: {
      clerk_user_id: "list-options",
      username: "list-options",
      email: "list-options@example.invalid",
    },
  });
  const guests = await Promise.all(
    Array.from({ length: 60 }, (_, index) =>
      prisma.guestUser.create({
        data: {
          name:
            index === 0
              ? "Zebra rare guest"
              : `Guest ${String(index).padStart(2, "0")}`,
          createdById: player.id,
        },
      }),
    ),
  );
  const games = await Promise.all(
    guests.map((guest, index) =>
      prisma.game.create({
        data: {
          kind: "PICKUP",
          createdAt: new Date(2026, 0, index + 1),
          players: { create: [{ userId: player.id }, { guestId: guest.id }] },
        },
      }),
    ),
  );
  const viewer = { userId: player.clerk_user_id };
  const first = await getGameListPageForViewer(viewer, {}, "current", prisma);
  assert.equal(first.games.length, GAME_LIST_PAGE_SIZE);
  assert.equal(first.playerOptions.length, GAME_PLAYER_OPTION_LIMIT);
  assert.equal(first.hasMorePlayerOptions, true);
  assert.ok(!first.games.some((game) => game.id === games[0].id));
  const search = await getGameListPageForViewer(
    viewer,
    { search: "zebra" },
    "current",
    prisma,
  );
  assert.deepEqual(search.playerOptions, [
    { key: `guest:${guests[0].id}`, name: "Zebra rare guest" },
  ]);
  const matching = await getGameListPageForViewer(
    viewer,
    {
      player: [`user:${player.id}`, `guest:${guests[0].id}`],
      search: "Guest 59",
    },
    "current",
    prisma,
  );
  assert.deepEqual(
    matching.games.map((game) => game.id),
    [games[0].id],
  );
  assert.equal(matching.totalMatches, 1);
  assert.ok(
    matching.playerOptions.some(
      (option) => option.key === `guest:${guests[0].id}`,
    ),
  );
  assert.ok(
    matching.playerOptions.some(
      (option) => option.key === `guest:${guests[59].id}`,
    ),
  );
  const nobody = await getGameListPageForViewer(
    viewer,
    { player: [`guest:${guests[0].id}`, `guest:${guests[1].id}`] },
    "current",
    prisma,
  );
  assert.equal(nobody.totalMatches, 0);
  const tooMany = await getGameListPageForViewer(
    viewer,
    { player: guests.slice(0, 9).map((guest) => `guest:${guest.id}`) },
    "current",
    prisma,
  );
  assert.equal(tooMany.totalMatches, 0);
});

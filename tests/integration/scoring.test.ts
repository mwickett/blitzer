import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeRound } from "../../src/server/scoring/writeRound";
import { getGameCompletion } from "../../src/lib/gameLogic";

assert.equal(
  process.env.BLITZER_INTEGRATION_TEST,
  "1",
  "Use the disposable database runner",
);
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const peer = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
after(async () => {
  await Promise.all([db.$disconnect(), peer.$disconnect()]);
});

test("the additive revision migration preserves a populated round table", async () => {
  const migration = readFileSync(
    "src/server/db/migrations/20260905000000_round_revision/migration.sql",
    "utf8",
  );
  await db.$transaction(async (tx) => {
    // A temporary table shadows public.Round only on this connection.
    await tx.$executeRawUnsafe(
      'CREATE TEMP TABLE "Round" (id TEXT PRIMARY KEY) ON COMMIT DROP',
    );
    await tx.$executeRaw`INSERT INTO "Round" (id) VALUES ('existing-round')`;
    await tx.$executeRawUnsafe(migration);
    const rows = await tx.$queryRaw<
      { id: string; revision: number }[]
    >`SELECT * FROM "Round"`;
    assert.deepEqual(rows, [{ id: "existing-round", revision: 0 }]);
  });
});

async function fixture(threshold = 50) {
  const id = randomUUID();
  const user = await db.user.create({
    data: {
      email: `${id}@example.test`,
      clerk_user_id: `clerk-${id}`,
      username: id,
    },
  });
  const guest = await db.guestUser.create({
    data: { name: "Guest", createdById: user.id },
  });
  const game = await db.game.create({
    data: {
      organizationId: id,
      winThreshold: threshold,
      players: { create: [{ userId: user.id }, { guestId: guest.id }] },
    },
  });
  const caller = { userId: user.clerk_user_id, orgId: id };
  const scores = (
    cards = 30,
    guestCards = 20,
    remaining = 0,
    guestRemaining = 5,
  ) => [
    { userId: user.id, totalCardsPlayed: cards, blitzPileRemaining: remaining },
    {
      guestId: guest.id,
      totalCardsPlayed: guestCards,
      blitzPileRemaining: guestRemaining,
    },
  ];
  return { game, caller, scores, user, guest };
}

async function snapshot(gameId: string) {
  return db.game.findUniqueOrThrow({
    where: { id: gameId },
    include: {
      players: { include: { user: true, guestUser: true } },
      rounds: { include: { scores: true }, orderBy: { round: "asc" } },
    },
  });
}

test("rejects invalid score shapes, participant references and round numbers without writes", async () => {
  const f = await fixture();
  for (const value of [-1, 41, 1.5, NaN, Infinity, "10", null]) {
    const scores = [
      { ...f.scores()[0], totalCardsPlayed: value },
      f.scores()[1],
    ];
    const result = await writeRound(db, f.caller, {
      kind: "create",
      gameId: f.game.id,
      roundNumber: 1,
      scores,
    });
    assert.equal(result.ok, false);
  }
  for (const scores of [
    null,
    [],
    [f.scores()[0], f.scores()[0]],
    [{ ...f.scores()[0], guestId: f.guest.id }, f.scores()[1]],
    [{ ...f.scores()[0], userId: "outsider" }, f.scores()[1]],
    f.scores(30, 20, 11),
    f.scores(3),
  ]) {
    assert.equal(
      (
        await writeRound(db, f.caller, {
          kind: "create",
          gameId: f.game.id,
          roundNumber: 1,
          scores,
        })
      ).ok,
      false,
    );
  }
  for (const roundNumber of [0, -1, 1.5, 99]) {
    assert.equal(
      (
        await writeRound(db, f.caller, {
          kind: "create",
          gameId: f.game.id,
          roundNumber,
          scores: f.scores(),
        })
      ).ok,
      false,
    );
  }
  assert.equal(await db.round.count({ where: { gameId: f.game.id } }), 0);
});

test("serializes concurrent final-round retries and rejects further rounds", async () => {
  const f = await fixture(25);
  const command = {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 1,
    scores: f.scores(),
  };
  const results = await Promise.all([
    writeRound(db, f.caller, command),
    writeRound(peer, f.caller, command),
  ]);
  assert.ok(results.every((result) => result.ok));
  assert.equal(
    results.filter(
      (result) => result.ok && result.transition?.kind === "finished",
    ).length,
    1,
  );
  const saved = await snapshot(f.game.id);
  assert.equal(saved.rounds.length, 1);
  assert.equal(saved.winnerId, f.user.id);
  assert.equal(saved.isFinished, true);
  const retry = await writeRound(peer, f.caller, command);
  assert.ok(retry.ok && retry.transition === null);
  assert.equal(
    (await snapshot(f.game.id)).endedAt?.getTime(),
    saved.endedAt?.getTime(),
  );
  const extra = await writeRound(db, f.caller, { ...command, roundNumber: 2 });
  assert.ok(!extra.ok && extra.reason === "game_finished");
  const conflicting = await writeRound(db, f.caller, {
    ...command,
    scores: f.scores(29),
  });
  assert.ok(!conflicting.ok && conflicting.reason === "round_conflict");
});

test("competing creates retain exactly one complete submission", async () => {
  const f = await fixture();
  const command = { kind: "create", gameId: f.game.id, roundNumber: 1 };
  const results = await Promise.all([
    writeRound(db, f.caller, { ...command, scores: f.scores(30) }),
    writeRound(peer, f.caller, { ...command, scores: f.scores(31) }),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.ok(
    results.some((result) => !result.ok && result.reason === "round_conflict"),
  );
  const saved = await snapshot(f.game.id);
  assert.equal(saved.rounds.length, 1);
  assert.equal(saved.rounds[0].scores.length, 2);
});

test("concurrent edits require the captured revision and completion matches the committed scores", async () => {
  const f = await fixture(25);
  const first = await writeRound(db, f.caller, {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 1,
    scores: f.scores(),
  });
  assert.ok(first.ok);
  const command = {
    kind: "edit",
    gameId: f.game.id,
    roundId: first.round.id,
    expectedRevision: 0,
  };
  const results = await Promise.all([
    writeRound(db, f.caller, { ...command, scores: f.scores(4) }),
    writeRound(peer, f.caller, { ...command, scores: f.scores(35) }),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.ok(
    results.some((result) => !result.ok && result.reason === "round_conflict"),
  );
  const saved = await snapshot(f.game.id);
  assert.equal(saved.rounds[0].revision, 1);
  assert.deepEqual(
    saved.rounds[0].scores
      .map((score) => ({ id: score.id, createdAt: score.createdAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    first.round.scores
      .map((score) => ({ id: score.id, createdAt: score.createdAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  assert.equal(saved.winnerId, getGameCompletion(saved).winnerId);
  assert.equal(saved.isFinished, !!saved.winnerId);
  assert.equal(saved.endedAt === null, !saved.isFinished);
  const winningWrite = results.find((result) => result.ok)!;
  assert.ok(winningWrite.ok);
  const retry = await writeRound(db, f.caller, {
    ...command,
    scores: winningWrite.round.scores.map(({ userId, guestId, ...score }) => ({
      totalCardsPlayed: score.totalCardsPlayed,
      blitzPileRemaining: score.blitzPileRemaining,
      ...(userId ? { userId } : { guestId }),
    })),
  });
  assert.ok(
    retry.ok && retry.transition === null && retry.round.revision === 1,
  );
  assert.equal(
    (
      await writeRound(db, f.caller, {
        ...command,
        expectedRevision: undefined,
        scores: f.scores(),
      })
    ).ok,
    false,
  );
});

test("historical edits change winner and reopen using the final totals", async () => {
  const f = await fixture();
  const first = await writeRound(db, f.caller, {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 1,
    scores: f.scores(),
  });
  const second = await writeRound(db, f.caller, {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 2,
    scores: f.scores(25),
  });
  assert.ok(first.ok && second.ok);
  assert.equal((await snapshot(f.game.id)).winnerId, f.user.id);
  const guestWins = await writeRound(db, f.caller, {
    kind: "edit",
    gameId: f.game.id,
    roundId: second.round.id,
    expectedRevision: 0,
    scores: f.scores(20, 40, 5, 0),
  });
  assert.ok(guestWins.ok && guestWins.transition === null);
  assert.equal((await snapshot(f.game.id)).winnerId, f.guest.id);
  const reopened = await writeRound(db, f.caller, {
    kind: "edit",
    gameId: f.game.id,
    roundId: second.round.id,
    expectedRevision: 1,
    scores: f.scores(4),
  });
  assert.ok(reopened.ok && reopened.transition?.kind === "reopened");
  const saved = await snapshot(f.game.id);
  assert.equal(saved.winnerId, null);
  assert.equal(saved.endedAt, null);
  assert.equal(saved.isFinished, false);
  assert.equal(saved.rounds.length, 2);
});

test("a failed completion update rolls back its round and scores", async () => {
  const f = await fixture(25);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_scoring_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${f.game.id}' AND NEW.is_finished THEN RAISE EXCEPTION 'integration completion failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    'CREATE TRIGGER fail_scoring_completion BEFORE UPDATE ON "Game" FOR EACH ROW EXECUTE FUNCTION fail_scoring_completion()',
  );
  try {
    await assert.rejects(
      writeRound(db, f.caller, {
        kind: "create",
        gameId: f.game.id,
        roundNumber: 1,
        scores: f.scores(),
      }),
      /integration completion failure/,
    );
    const saved = await snapshot(f.game.id);
    assert.equal(saved.rounds.length, 0);
    assert.equal(saved.isFinished, false);
    assert.equal(saved.winnerId, null);
  } finally {
    await db.$executeRawUnsafe(
      'DROP TRIGGER fail_scoring_completion ON "Game"',
    );
    await db.$executeRawUnsafe("DROP FUNCTION fail_scoring_completion()");
  }
});

test("an unchanged corrective edit repairs stale completion from older versions", async () => {
  const f = await fixture();
  const first = await writeRound(db, f.caller, {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 1,
    scores: f.scores(),
  });
  assert.ok(first.ok);
  await db.game.update({
    where: { id: f.game.id },
    data: { isFinished: true, winnerId: f.user.id, endedAt: new Date() },
  });
  const corrected = await writeRound(db, f.caller, {
    kind: "edit",
    gameId: f.game.id,
    roundId: first.round.id,
    expectedRevision: 0,
    scores: f.scores(),
  });
  assert.ok(corrected.ok && corrected.transition?.kind === "reopened");
  assert.equal(corrected.round.revision, 0);
  assert.equal((await snapshot(f.game.id)).isFinished, false);
  assert.ok(
    (
      await writeRound(db, f.caller, {
        kind: "create",
        gameId: f.game.id,
        roundNumber: 2,
        scores: f.scores(4),
      })
    ).ok,
  );
});

test("rechecks circle and pickup authorization inside the locked transaction", async () => {
  const f = await fixture();
  const command = {
    kind: "create",
    gameId: f.game.id,
    roundNumber: 1,
    scores: f.scores(),
  };
  await assert.rejects(
    writeRound(db, { ...f.caller, orgId: "other" }, command),
    /active circle/,
  );
  await db.game.update({
    where: { id: f.game.id },
    data: { kind: "PICKUP", startedAt: null },
  });
  await assert.rejects(writeRound(db, f.caller, command), /not a player/);
  await db.game.update({
    where: { id: f.game.id },
    data: { startedAt: new Date() },
  });
  await assert.rejects(
    writeRound(db, { userId: "outsider" }, command),
    /not a player/,
  );
  assert.equal(await db.round.count({ where: { gameId: f.game.id } }), 0);
  assert.ok((await writeRound(db, f.caller, command)).ok);
});

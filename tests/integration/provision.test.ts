import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import prisma from "../../src/server/db/db";
import {
  AccountEmailConflictError,
  resolveClerkUser,
} from "../../src/server/users/provision";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use the disposable database runner");
after(() => prisma.$disconnect());

const profile = (id: string, username = id) => ({
  email: `${id}@example.test`,
  username,
  avatarUrl: null,
});

test("Prisma PostgreSQL username conflicts recover during account creation and profile sync", async (context) => {
  const ownerId = randomUUID();
  const owner = await resolveClerkUser(ownerId, () => profile(ownerId));
  // Record real adapter metadata so the application assertion is exercised
  // against PostgreSQL, rather than a hand-written P2002 mock.
  await assert.rejects(
    prisma.user.create({
      data: {
        clerk_user_id: randomUUID(),
        email: `${randomUUID()}@example.test`,
        username: owner.username,
      },
    }),
    (error: unknown) => {
      assert.ok(error && typeof error === "object" && "code" in error);
      assert.equal(error.code, "P2002");
      context.diagnostic(`PostgreSQL P2002 metadata: ${JSON.stringify("meta" in error ? error.meta : null)}`);
      return true;
    },
  );

  const newcomerId = randomUUID();
  const newcomer = await resolveClerkUser(newcomerId, () => profile(newcomerId, owner.username));
  assert.equal(newcomer.clerk_user_id, newcomerId);
  assert.notEqual(newcomer.username, owner.username);

  const updated = await resolveClerkUser(newcomerId, () => ({
    ...profile(newcomerId, owner.username),
    avatarUrl: "https://example.test/updated-avatar.png",
  }), "sync");
  assert.equal(updated.id, newcomer.id);
  assert.equal(updated.username, newcomer.username);
  assert.equal(updated.avatarUrl, "https://example.test/updated-avatar.png");
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: owner.id } }), owner);
});

test("concurrent provisioning converges on one Clerk-owned account and never transfers email ownership", async () => {
  const id = randomUUID();
  let loaded = 0;
  let release!: () => void;
  const profilesReady = new Promise<void>((resolve) => { release = resolve; });
  const loadProfile = async () => {
    if (++loaded === 2) release();
    await profilesReady;
    return profile(id);
  };
  const [first, second] = await Promise.all([
    resolveClerkUser(id, loadProfile),
    resolveClerkUser(id, loadProfile),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(await prisma.user.count({ where: { clerk_user_id: id } }), 1);

  const otherId = randomUUID();
  await assert.rejects(resolveClerkUser(otherId, () => profile(id)), AccountEmailConflictError);
  assert.equal(await prisma.user.count({ where: { clerk_user_id: otherId } }), 0);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: first.id } }), first);
});

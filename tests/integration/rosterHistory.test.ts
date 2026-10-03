import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { EMPTY_ROSTER_HISTORY, getRosterHistory } from "../../src/server/queries/rosterHistory";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

test("roster history counts only earlier finished games with everyone at the table", async () => {
  const user = await prisma.user.create({ data: {
    clerk_user_id: "roster-player", email: "roster-player@example.invalid", username: "roster-player",
  } });
  const [gran, sam, outsider] = await Promise.all(["Gran", "Sam", "Outsider"].map((name) =>
    prisma.guestUser.create({ data: { name, createdById: user.id } })));
  const seats = (...guests: { id: string }[]) => ({ create: [{ userId: user.id }, ...guests.map((guest) => ({ guestId: guest.id }))] });
  const finished = (winnerId: string | null, endedAt: string, players: ReturnType<typeof seats>) =>
    prisma.game.create({ data: { isFinished: true, winnerId, endedAt: new Date(endedAt), players } });

  await finished(gran.id, "2026-09-01T12:00:00Z", seats(gran, sam));
  await finished(user.id, "2026-09-02T12:00:00Z", seats(gran, sam, outsider)); // Extra player still counts.
  await finished(outsider.id, "2026-09-03T12:00:00Z", seats(gran, sam, outsider));
  await finished(user.id, "2026-09-04T12:00:00Z", seats(gran)); // Sam missing.
  await finished(null, "2026-09-05T12:00:00Z", seats(gran, sam)); // No recorded winner.
  await prisma.game.create({ data: { winnerId: null, players: seats(gran, sam) } }); // In progress.
  const current = await prisma.game.create({ data: { players: seats(gran, sam) } });

  const history = await getRosterHistory(current.id, [user.id, gran.id, sam.id], prisma);
  assert.deepEqual(history, {
    gamesTogether: 3,
    winsByPlayer: { [gran.id]: 1, [user.id]: 1 },
    lastWinnerId: outsider.id,
  });
  assert.deepEqual(await getRosterHistory(current.id, [user.id], prisma), EMPTY_ROSTER_HISTORY);
});

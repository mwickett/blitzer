import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { MockLanguageModelV3 } from "ai/test";
import { PrismaClient } from "../../src/generated/prisma/client";
import { getOrCreateGameStory } from "../../src/server/ai/gameStory";

assert.equal(process.env.BLITZER_INTEGRATION_TEST, "1", "Use npm run test:integration");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
after(() => prisma.$disconnect());

const model = (text: string) => new MockLanguageModelV3({ doGenerate: async () => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
  warnings: [],
}) });

test("game stories persist once per score revision", async () => {
  const user = await prisma.user.create({ data: {
    clerk_user_id: "story-player", email: "story-player@example.invalid", username: "story-player",
  } });
  const guest = await prisma.guestUser.create({ data: { name: "Story Guest", createdById: user.id } });
  const created = await prisma.game.create({ data: {
    winThreshold: 25, isFinished: true, winnerId: user.id,
    players: { create: [{ userId: user.id }, { guestId: guest.id }] },
    rounds: { create: { round: 1, scores: { create: [
      { userId: user.id, totalCardsPlayed: 30, blitzPileRemaining: 0 },
      { guestId: guest.id, totalCardsPlayed: 4, blitzPileRemaining: 0 },
    ] } } },
  } });
  const load = () => prisma.game.findUniqueOrThrow({
    where: { id: created.id },
    include: { players: { include: { user: true, guestUser: true } }, rounds: { include: { scores: true } } },
  });

  const first = await getOrCreateGameStory(await load(), { db: prisma, model: model("First telling.") });
  assert.equal(first?.story, "First telling.");
  const again = await getOrCreateGameStory(await load(), { db: prisma, model: model("Unused.") });
  assert.equal(again?.story, "First telling.");

  await prisma.round.updateMany({ where: { gameId: created.id }, data: { revision: { increment: 1 } } });
  const retold = await getOrCreateGameStory(await load(), { db: prisma, model: model("Corrected telling.") });
  assert.equal(retold?.story, "Corrected telling.");
  assert.equal(await prisma.gameStory.count({ where: { gameId: created.id } }), 1);
});

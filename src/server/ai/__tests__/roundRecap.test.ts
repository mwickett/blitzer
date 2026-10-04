/** @jest-environment node */
import { MockLanguageModelV3 } from "ai/test";
import { buildRoundRecapPrompt, writeRoundRecap } from "../roundRecap";
import { EMPTY_ROSTER_HISTORY } from "@/server/queries/rosterHistory";

jest.mock("@/server/db/db", () => ({ __esModule: true, default: {} }));

const player = (id: string, name: string) => ({ id: `seat-${id}`, userId: id, guestId: null, accentColor: null, user: { username: name }, guestUser: null });
const hand = (userId: string, totalCardsPlayed: number, blitzPileRemaining: number) => ({ userId, guestId: null, totalCardsPlayed, blitzPileRemaining });

const game = {
  isFinished: false,
  winThreshold: 75,
  players: [player("mike", "Mike"), player("carol", "Carol")],
  rounds: [
    { round: 1, scores: [hand("mike", 20, 0), hand("carol", 10, 2)] },
    { round: 2, scores: [hand("mike", 4, 8), hand("carol", 30, 0)] },
  ],
};

it("summarizes standings, the latest round and the group's history", () => {
  const prompt = buildRoundRecapPrompt(game, { gamesTogether: 3, winsByPlayer: { carol: 2, mike: 1 }, lastWinnerId: "carol" })!;
  expect(prompt).toContain("After round 2 of a game to 75 points.");
  expect(prompt).toContain('1. "Carol": 36 points (+30 this round)');
  expect(prompt).toContain('2. "Mike": 8 points (-12 this round)');
  expect(prompt).toContain("Leader needs 39 more points to win.");
  expect(prompt).toContain('Best round this time: "Carol" with 30.');
  expect(prompt).toContain('Rough round: "Mike" with -12.');
  expect(prompt).toContain('Blitzed this round: "Carol".');
  expect(prompt).toContain('finished 3 earlier games together. Wins: "Carol" 2, "Mike" 1.');
  expect(prompt).toContain('"Carol" won their last game together.');
  expect(prompt).toContain('Lead change this round: "Carol" took the lead from "Mike".');
  // Two players can't U-turn; it is just a lead change.
  expect(prompt).not.toContain("U-turn");
});

it("names a U-turn that happened in the round just played", () => {
  const threeWay = {
    ...game,
    players: [...game.players, player("ann", "Ann")],
    rounds: [
      { round: 1, scores: [hand("mike", 30, 0), hand("carol", 10, 0), hand("ann", 4, 4)] },
      { round: 2, scores: [hand("mike", 2, 6), hand("carol", 5, 5), hand("ann", 40, 0)] },
    ],
  };
  const prompt = buildRoundRecapPrompt(threeWay, EMPTY_ROSTER_HISTORY)!;
  expect(prompt).toContain('Named moment this round, U-turn: "Ann" went from last to first in round 2.');
  expect(prompt).toContain('Lead change this round: "Ann" took the lead from "Mike".');

  // A U-turn from an earlier round is old news by round three.
  const later = { ...threeWay, rounds: [...threeWay.rounds, { round: 3, scores: [hand("mike", 5, 0), hand("carol", 5, 0), hand("ann", 5, 0)] }] };
  const quiet = buildRoundRecapPrompt(later, EMPTY_ROSTER_HISTORY)!;
  expect(quiet).not.toContain("U-turn");
  expect(quiet).not.toContain("Lead change");
});

it("notes a first game together and has nothing to say before round one", () => {
  expect(buildRoundRecapPrompt(game, EMPTY_ROSTER_HISTORY)).toContain("first game this group has finished together");
  expect(buildRoundRecapPrompt({ ...game, rounds: [] }, EMPTY_ROSTER_HISTORY)).toBeNull();
});

it("asks the model for a short spoken recap", async () => {
  const model = new MockLanguageModelV3({ doGenerate: async () => ({
    content: [{ type: "text", text: " Carol surges ahead! " }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    warnings: [],
  }) });
  expect(await writeRoundRecap(game, EMPTY_ROSTER_HISTORY, { model })).toBe("Carol surges ahead!");
  expect(model.doGenerateCalls[0].maxOutputTokens).toBe(200);
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("never invent");
});

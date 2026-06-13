import {
  buildGameRecap,
  latestSourceUpdatedAt,
} from "@/lib/insights/gameRecap";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";

type ScoreInput = { key: string; cards: number; blitz: number };

function makeGame(
  winThreshold: number,
  names: Record<string, string>,
  roundsData: ScoreInput[][]
): GameWithPlayersAndScores {
  const players = Object.entries(names).map(([key, username]) => ({
    id: `gp_${key}`,
    gameId: "game_1",
    userId: key,
    guestId: null,
    accentColor: null,
    user: { id: key, username } as never,
    guestUser: null,
  }));
  const rounds = roundsData.map((scores, ri) => ({
    id: `r${ri + 1}`,
    gameId: "game_1",
    round: ri + 1,
    createdAt: new Date("2026-06-13T00:00:00Z"),
    scores: scores.map((s) => ({
      id: `s_${ri}_${s.key}`,
      roundId: `r${ri + 1}`,
      userId: s.key,
      guestId: null,
      totalCardsPlayed: s.cards,
      blitzPileRemaining: s.blitz,
      createdAt: new Date("2026-06-13T00:00:00Z"),
      updatedAt: new Date(`2026-06-13T00:0${ri}:00Z`),
    })),
  }));
  return {
    id: "game_1",
    winThreshold,
    organizationId: "org_1",
    isFinished: true,
    createdAt: new Date("2026-06-13T00:00:00Z"),
    endedAt: new Date("2026-06-13T01:00:00Z"),
    winnerId: null,
    players,
    rounds,
  } as unknown as GameWithPlayersAndScores;
}

describe("buildGameRecap", () => {
  it("keys facts by playerKey and keeps real names out of the facts", () => {
    // u1: 20-0=20, 18-4=14 -> 34 (wins, threshold 30). u2: 8, 10 -> 18.
    const { facts, playerNames } = buildGameRecap(
      makeGame(
        30,
        { u1: "Mike", u2: "Sarah" },
        [
          [
            { key: "u1", cards: 20, blitz: 0 },
            { key: "u2", cards: 14, blitz: 3 },
          ],
          [
            { key: "u1", cards: 18, blitz: 2 },
            { key: "u2", cards: 10, blitz: 0 },
          ],
        ]
      )
    );

    expect(facts.winnerKey).toBe("u1");
    expect(facts.standings[0].playerKey).toBe("u1");
    expect(facts.standings[0].total).toBe(34);
    expect(facts.standings[1].total).toBe(18);
    expect(facts.biggestRound).toEqual({
      delta: 20,
      playerKey: "u1",
      roundNumber: 1,
    });
    expect(facts.totalBlitzes).toBe(2);
    expect(facts.blitzLeader?.blitzes).toBe(1);
    // No real names leaked into the facts.
    expect(JSON.stringify(facts)).not.toContain("Mike");
    expect(JSON.stringify(facts)).not.toContain("Sarah");
    expect(playerNames).toEqual({ u1: "Mike", u2: "Sarah" });
  });

  it("puts the tiebreak winner at rank 1 even when totals are equal", () => {
    // Both reach 20 (threshold 20). Final round blitz: u1=1, u2=0 -> u2 wins.
    const { facts } = buildGameRecap(
      makeGame(
        20,
        { u1: "Mike", u2: "Sarah" },
        [
          [
            { key: "u1", cards: 12, blitz: 0 },
            { key: "u2", cards: 14, blitz: 1 },
          ],
          [
            { key: "u1", cards: 10, blitz: 1 },
            { key: "u2", cards: 8, blitz: 0 },
          ],
        ]
      )
    );

    expect(facts.standings[0].total).toBe(facts.standings[1].total); // tie
    expect(facts.winnerKey).toBe("u2");
    expect(facts.standings[0].playerKey).toBe("u2");
    expect(facts.tiebreakUsed).toBe(true);
  });
});

describe("latestSourceUpdatedAt", () => {
  it("returns the newest score updatedAt", () => {
    const game = makeGame(
      30,
      { u1: "Mike", u2: "Sarah" },
      [
        [
          { key: "u1", cards: 20, blitz: 0 },
          { key: "u2", cards: 14, blitz: 3 },
        ],
        [
          { key: "u1", cards: 18, blitz: 2 },
          { key: "u2", cards: 10, blitz: 0 },
        ],
      ]
    );
    // round index 1 -> 2026-06-13T00:01:00Z is the newest
    expect(latestSourceUpdatedAt(game).toISOString()).toBe(
      "2026-06-13T00:01:00.000Z"
    );
  });
});

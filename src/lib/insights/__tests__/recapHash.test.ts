import { hashRecapFacts, stableStringify } from "@/lib/insights/recapHash";
import type { GameRecapFacts } from "@/lib/insights/gameRecap";

const facts = (overrides: Partial<GameRecapFacts> = {}): GameRecapFacts => ({
  gameId: "g1",
  organizationId: "o1",
  winThreshold: 75,
  roundsPlayed: 3,
  playerCount: 2,
  standings: [
    { playerKey: "u1", total: 80, isWinner: true, rank: 1 },
    { playerKey: "u2", total: 40, isWinner: false, rank: 2 },
  ],
  winnerKey: "u1",
  tiebreakUsed: false,
  biggestRound: { delta: 20, playerKey: "u1", roundNumber: 1 },
  worstRound: { delta: -4, playerKey: "u2", roundNumber: 2 },
  blitzLeader: { playerKey: "u1", blitzes: 2 },
  totalBlitzes: 3,
  leadChanges: 1,
  ...overrides,
});

describe("hashRecapFacts", () => {
  it("is stable for equal facts", () => {
    expect(hashRecapFacts(facts())).toBe(hashRecapFacts(facts()));
  });

  it("changes when a number changes", () => {
    expect(hashRecapFacts(facts())).not.toBe(
      hashRecapFacts(facts({ totalBlitzes: 4 }))
    );
  });

  it("stableStringify sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

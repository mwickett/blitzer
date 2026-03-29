import { breakTie } from "../scoring/tiebreak";

describe("breakTie", () => {
  it("returns the player with fewest blitz cards remaining", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: 5 },
      { playerId: "b", blitzPileRemaining: 2 },
      { playerId: "c", blitzPileRemaining: 7 },
    ];
    expect(breakTie(candidates)).toBe("b");
  });

  it("returns the first player when all have equal remaining", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: 3 },
      { playerId: "b", blitzPileRemaining: 3 },
    ];
    expect(breakTie(candidates)).toBe("a");
  });

  it("returns the single candidate when only one", () => {
    const candidates = [{ playerId: "a", blitzPileRemaining: 10 }];
    expect(breakTie(candidates)).toBe("a");
  });

  it("uses default of 10 when blitzPileRemaining is null", () => {
    const candidates = [
      { playerId: "a", blitzPileRemaining: null },
      { playerId: "b", blitzPileRemaining: 5 },
    ];
    expect(breakTie(candidates as any)).toBe("b");
  });
});

describe("breakTie — rounds mutation usage pattern", () => {
  it("selects winner from string playerIds mapped via scores", () => {
    const topPlayers = ["user-1", "user-2"];
    const finalRoundScores = [
      { id: "s1", userId: "user-1", guestId: null, blitzPileRemaining: 4, totalCardsPlayed: 22 },
      { id: "s2", userId: "user-2", guestId: null, blitzPileRemaining: 1, totalCardsPlayed: 25 },
    ];

    const candidates = topPlayers.map((pid) => {
      const s = finalRoundScores.find(
        (sc) => (sc.userId ?? sc.guestId ?? "") === pid
      );
      return { playerId: pid, blitzPileRemaining: s?.blitzPileRemaining ?? 10 };
    });

    expect(breakTie(candidates)).toBe("user-2");
  });
});

import {
  describeHighlight,
  findGameHighlights,
  findScoredGameHighlights,
} from "../scoring/gameHighlights";

const players = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Cara" },
];

const cumulative = (deltas: Record<string, number[]>) =>
  Object.fromEntries(
    Object.entries(deltas).map(([id, ds]) => {
      let total = 0;
      return [id, ds.map((d) => (total += d))];
    }),
  );

const noBlitz = { a: [], b: [], c: [] };

function highlights(
  deltasByRound: Record<string, number[]>,
  winnerId: string,
  blitzByRound: Record<string, (number | null)[]> = noBlitz,
) {
  return findGameHighlights({
    players,
    winnerId,
    scoresByRound: cumulative(deltasByRound),
    deltasByRound,
    blitzByRound,
  });
}

describe("findGameHighlights", () => {
  it("spots a wire-to-wire win", () => {
    const result = highlights(
      { a: [20, 20, 20, 20], b: [10, 10, 10, 10], c: [5, 5, 5, 5] },
      "a",
    );
    expect(result).toEqual([{ kind: "wire_to_wire", playerId: "a" }]);
  });

  it("spots a comeback, lead changes, and a photo finish", () => {
    // After R1 Bob +20; R2 Bob by 22 over Alice; R3 Alice closes; R4 Alice wins by 2.
    const result = highlights(
      { a: [0, 5, 30, 42], b: [20, 7, 10, 38], c: [1, 1, 1, 1] },
      "a",
    );
    expect(result).toContainEqual({
      kind: "comeback",
      playerId: "a",
      deficit: 22,
      roundNumber: 2,
    });
    expect(result).toContainEqual({
      kind: "photo_finish",
      playerId: "a",
      margin: 2,
    });
    expect(result.find((h) => h.kind === "lead_changes")).toBeUndefined();
  });

  it("counts lead changes and ignores tied rounds", () => {
    const result = highlights(
      // Leaders: a, tie, b, a → two changes.
      { a: [10, 0, 0, 30], b: [0, 10, 10, 0], c: [0, 0, 0, 0] },
      "a",
    );
    expect(result).toContainEqual({ kind: "lead_changes", count: 2 });
  });

  it("finds a lone survivor round and the longest blitz streak", () => {
    const result = highlights(
      { a: [12, 30, 30], b: [-4, 2, 2], c: [-6, 1, 1] },
      "a",
      { a: [2, 0, 0], b: [0, 0, 0], c: [3, 3, 3] },
    );
    expect(result).toContainEqual({
      kind: "lone_survivor",
      playerId: "a",
      roundNumber: 1,
    });
    expect(result).toContainEqual({
      kind: "blitz_streak",
      playerId: "b",
      length: 3,
    });
  });

  it("returns nothing without rounds", () => {
    expect(highlights({ a: [], b: [], c: [] }, "a")).toEqual([]);
  });
});

describe("findScoredGameHighlights", () => {
  const score = (
    id: { userId?: string; guestId?: string },
    totalCardsPlayed: number,
    blitzPileRemaining: number,
  ) => ({
    userId: id.userId ?? null,
    guestId: id.guestId ?? null,
    totalCardsPlayed,
    blitzPileRemaining,
  });

  it("detects moments straight from a stored game, in round order", () => {
    const game = {
      isFinished: true,
      winThreshold: 75,
      players: [
        {
          id: "gp1",
          userId: "u1",
          guestId: null,
          accentColor: null,
          user: { username: "alice" },
          guestUser: null,
        },
        {
          id: "gp2",
          userId: null,
          guestId: "g1",
          accentColor: null,
          user: null,
          guestUser: { name: "Bob" },
        },
      ],
      // Stored out of order on purpose.
      rounds: [
        {
          round: 2,
          scores: [
            score({ userId: "u1" }, 40, 0),
            score({ guestId: "g1" }, 5, 0),
          ],
        },
        {
          round: 1,
          scores: [
            score({ userId: "u1" }, 2, 0),
            score({ guestId: "g1" }, 30, 0),
          ],
        },
        {
          round: 3,
          scores: [
            score({ userId: "u1" }, 40, 0),
            score({ guestId: "g1" }, 44, 2),
          ],
        },
      ],
    };
    const result = findScoredGameHighlights(game);
    expect(result.winnerId).toBe("u1");
    expect(result.players).toEqual([
      { id: "u1", name: "alice" },
      { id: "g1", name: "Bob" },
    ]);
    expect(result.highlights).toContainEqual({
      kind: "comeback",
      playerId: "u1",
      deficit: 28,
      roundNumber: 1,
    });
    expect(result.highlights).toContainEqual({
      kind: "blitz_streak",
      playerId: "u1",
      length: 3,
    });
  });

  it("returns no highlights for a game without a winner", () => {
    const result = findScoredGameHighlights({
      isFinished: false,
      winThreshold: 75,
      players: [],
      rounds: [],
    });
    expect(result).toEqual({ players: [], winnerId: null, highlights: [] });
  });
});

describe("describeHighlight", () => {
  it("writes plain-language copy", () => {
    expect(
      describeHighlight({ kind: "lead_changes", count: 3 }, () => "").detail,
    ).toBe("The lead changed hands 3 times.");
  });
});

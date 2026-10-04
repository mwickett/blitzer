import {
  describeNamedMoment,
  findNamedMoments,
  findScoredGameNamedMoments,
  summarizeMomentHistory,
  type MomentHistoryGame,
} from "../scoring/namedMoments";
import { findLeadChanges } from "../scoring/gameHighlights";

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

function moments(deltas: Record<string, number[]>, winnerId: string, winThreshold?: number) {
  return findNamedMoments({ players, winnerId, scoresByRound: cumulative(deltas), winThreshold });
}

const name = (id: string) => players.find((p) => p.id === id)?.name ?? "Someone";

describe("findNamedMoments", () => {
  it("spots a tornado: last to first while the leader falls to last", () => {
    // After R2: Bob leads (30), Cara 10, Alice last (0). Finals: Alice 80, Cara 25, Bob 22.
    const result = moments(
      { a: [0, 0, 40, 40], b: [15, 15, -5, -3], c: [5, 5, 5, 10] },
      "a",
    );
    expect(result).toContainEqual({ kind: "tornado", playerId: "a", victimId: "b", roundNumber: 2 });
  });

  it("needs the old leader to finish last for a tornado", () => {
    const result = moments(
      { a: [0, 0, 40, 40], b: [15, 15, 5, 10], c: [5, 5, -5, -3] },
      "a",
    );
    expect(result.find((m) => m.kind === "tornado")).toBeUndefined();
  });

  it("spots the first U-turn from last to first in one round", () => {
    const result = moments(
      { a: [0, 30, 10, 40], b: [10, 0, 0, 0], c: [5, 0, 0, 0] },
      "a",
    );
    expect(result).toContainEqual({ kind: "u_turn", playerId: "a", roundNumber: 2 });
  });

  it("skips tornadoes and U-turns between two players", () => {
    const result = findNamedMoments({
      players: players.slice(0, 2),
      winnerId: "a",
      scoresByRound: cumulative({ a: [0, 30, 10, 40], b: [10, 0, 0, 0] }),
    });
    expect(result.map((m) => m.kind)).toEqual(["short_fuse"]);
  });

  it("calls a quick game to the standard target a short fuse", () => {
    const quick = { a: [25, 25, 26], b: [5, 5, 5], c: [1, 1, 1] };
    expect(moments(quick, "a")).toContainEqual({ kind: "short_fuse", playerId: "a", roundCount: 3 });
    // A lower target makes a short game expected.
    expect(moments(quick, "a", 50).find((m) => m.kind === "short_fuse")).toBeUndefined();
    const long = { a: [15, 15, 15, 15, 15], b: [5, 5, 5, 5, 5], c: [1, 1, 1, 1, 1] };
    expect(moments(long, "a").find((m) => m.kind === "short_fuse")).toBeUndefined();
  });

  it("names the lowest finish below zero a shortcoming", () => {
    const result = moments(
      { a: [15, 15, 15, 15, 15], b: [-5, -5, 5, 0, 0], c: [-10, -10, 0, 0, 0] },
      "a",
    );
    expect(result).toContainEqual({ kind: "shortcoming", playerId: "c", score: -20 });
  });

  it("returns nothing without rounds", () => {
    expect(moments({ a: [], b: [], c: [] }, "a")).toEqual([]);
  });
});

describe("findLeadChanges", () => {
  it("records who took the lead from whom, through ties", () => {
    // Leaders: a, tie, b, a.
    expect(
      findLeadChanges(players, cumulative({ a: [10, 0, 0, 30], b: [0, 10, 10, 0], c: [0, 0, 0, 0] })),
    ).toEqual([
      { roundNumber: 3, playerId: "b", previousLeaderId: "a" },
      { roundNumber: 4, playerId: "a", previousLeaderId: "b" },
    ]);
  });
});

describe("findScoredGameNamedMoments", () => {
  it("reads a stored game with its target", () => {
    const seat = (id: string, username: string) => ({
      id: `gp-${id}`, userId: id, guestId: null, accentColor: null, user: { username }, guestUser: null,
    });
    const score = (userId: string, totalCardsPlayed: number) => ({
      userId, guestId: null, totalCardsPlayed, blitzPileRemaining: 0,
    });
    const result = findScoredGameNamedMoments({
      isFinished: true,
      winThreshold: 75,
      players: [seat("u1", "alice"), seat("u2", "bob")],
      rounds: [
        { round: 2, scores: [score("u1", 40), score("u2", 0)] },
        { round: 1, scores: [score("u1", 40), score("u2", 2)] },
      ],
    });
    expect(result.winnerId).toBe("u1");
    expect(result.moments).toEqual([{ kind: "short_fuse", playerId: "u1", roundCount: 2 }]);
  });
});

describe("describeNamedMoment", () => {
  it("keeps the viewer's name readable mid-sentence", () => {
    const you = (id: string) => (id === "b" ? "You" : name(id));
    expect(
      describeNamedMoment({ kind: "tornado", playerId: "a", victimId: "b", roundNumber: 3 }, you).detail,
    ).toBe("Alice climbed from dead last after round 3 to the win, while you, leading then, finished last.");
  });
});

describe("summarizeMomentHistory", () => {
  const game = (
    gameId: string,
    finishedAt: string,
    winnerId: string | null,
    deltas: Record<string, number[]>,
  ): MomentHistoryGame => ({
    gameId,
    finishedAt,
    winnerId,
    winThreshold: 75,
    players,
    scoresByRound: cumulative(deltas),
  });

  const games = [
    // Oldest: Alice loses to Bob, wire to wire, in six rounds.
    game("g1", "2026-09-01T00:00:00Z", "b", { a: [5, 5, 5, 5, 5, 5], b: [15, 15, 15, 15, 15, 15], c: [0, 0, 0, 0, 0, 0] }),
    // Alice bounces back with a tornado over Bob, who finishes last.
    game("g2", "2026-09-02T00:00:00Z", "a", { a: [0, 0, 40, 40, 0], b: [15, 15, -5, -3, 0], c: [5, 5, 5, 10, 0] }),
    // No winner recorded: lead changes still count.
    game("g3", "2026-09-03T00:00:00Z", null, { a: [10, 0, 0, 30], b: [0, 10, 10, 0], c: [0, 0, 0, 0] }),
  ];

  it("tallies lead changes, the viewer's moments, and bounce backs", () => {
    const result = summarizeMomentHistory(games, "a");
    expect(result.leadChanges).toEqual({
      gamesAnalyzed: 3,
      gamesWithLeadChanges: 2,
      // g2: Bob leads, then Alice from round 3. g3: Alice, Bob, Alice.
      totalLeadChanges: 3,
      leadsTaken: 2,
      leadsLost: 1,
      winsFromBehind: 1,
      mostLeadChanges: { gameId: "g3", finishedAt: "2026-09-03T00:00:00Z", count: 2 },
    });
    expect(result.mine).toEqual({ tornado: 1, u_turn: 1, short_fuse: 0, shortcoming: 0, bounce_back: 1 });
    expect(result.feed.map((item) => item.key)).toEqual(["g2:tornado", "g2:u_turn"]);
    expect(result.feed[0]).toMatchObject({ starring: true, title: "Tornado" });
    expect(result.feed[0].detail).toMatch(/^You climbed/);
  });

  it("counts tornadoes the viewer suffered", () => {
    expect(summarizeMomentHistory(games, "b").tornadoesSuffered).toBe(1);
    expect(summarizeMomentHistory(games, "b").mine.bounce_back).toBe(0);
  });

  it("caps the feed and handles no games", () => {
    expect(summarizeMomentHistory(games, "a", 1).feed).toHaveLength(1);
    expect(summarizeMomentHistory([], "a").leadChanges.gamesAnalyzed).toBe(0);
  });
});

import {
  BADGES,
  computeBadges,
  gameMomentBadges,
  type BadgeGame,
} from "../scoring/badges";

const players = [
  { id: "a", name: "Alice" },
  { id: "b", name: "Bob" },
  { id: "c", name: "Cara" },
];

let seq = 0;
/** A finished game from per-round [cards, blitz pile] lines per player. */
function game(
  lines: Record<string, [number, number][]>,
  winnerId: string | null,
  winThreshold = 75,
): BadgeGame {
  seq++;
  const ids = Object.keys(lines);
  const deltasByRound = Object.fromEntries(
    ids.map((id) => [id, lines[id].map(([cards, pile]) => cards - 2 * pile)]),
  );
  const scoresByRound = Object.fromEntries(
    ids.map((id) => {
      let total = 0;
      return [id, deltasByRound[id].map((d) => (total += d))];
    }),
  );
  return {
    gameId: `g${seq}`,
    finishedAt: new Date(Date.UTC(2026, 0, seq)).toISOString(),
    winnerId,
    winThreshold,
    players: players.filter((p) => ids.includes(p.id)),
    scoresByRound,
    deltasByRound,
    blitzByRound: Object.fromEntries(
      ids.map((id) => [id, lines[id].map(([, pile]) => pile)]),
    ),
  };
}

const byId = (progress: ReturnType<typeof computeBadges>) =>
  Object.fromEntries(progress.map((p) => [p.badge.id, p]));

describe("gameMomentBadges", () => {
  it("credits named moments and highlights to the player who starred", () => {
    // Alice blitzes every round and wins in three: Short fuse, Triple blitz,
    // Wire to wire. Bob alone goes below zero.
    const g = game(
      {
        a: [[30, 0], [30, 0], [20, 0]],
        b: [[10, 2], [5, 4], [0, 5]],
        c: [[12, 1], [14, 1], [10, 2]],
      },
      "a",
    );
    expect(gameMomentBadges(g, "a")).toEqual(["short_fuse", "triple_blitz", "wire_to_wire"]);
    expect(gameMomentBadges(g, "b")).toEqual(["shortcoming"]);
    expect(gameMomentBadges(g, "c")).toEqual([]);
  });

  it("gives the runner-up of a photo finish a Heartbreaker", () => {
    const g = game(
      {
        a: [[40, 0], [37, 0]],
        b: [[39, 0], [35, 0]],
        c: [[10, 0], [10, 0]],
      },
      "a",
    );
    expect(gameMomentBadges(g, "a")).toContain("photo_finish");
    expect(gameMomentBadges(g, "b")).toContain("heartbreaker");
    expect(gameMomentBadges(g, "c")).not.toContain("heartbreaker");
  });

  it("finds nothing in a game without a winner", () => {
    expect(gameMomentBadges(game({ a: [[30, 0]], b: [[0, 10]] }, null), "a")).toEqual([]);
  });
});

describe("computeBadges", () => {
  it("lists every badge in catalog order, locked until earned", () => {
    const progress = computeBadges([], "a");
    expect(progress.map((p) => p.badge.id)).toEqual(BADGES.map((b) => b.id));
    expect(progress.every((p) => p.count === 0 && p.firstGameId === null)).toBe(true);
  });

  it("dates each badge to the first game that earned it and counts repeats", () => {
    const loss = game({ a: [[10, 3], [10, 3]], b: [[40, 0], [40, 0]] }, "b");
    const win1 = game({ a: [[40, 0], [40, 0]], b: [[10, 3], [10, 3]] }, "a");
    const win2 = game({ a: [[40, 0], [40, 0]], b: [[10, 3], [10, 3]] }, "a");
    // Order of the input doesn't matter.
    const progress = byId(computeBadges([win2, loss, win1], "a"));

    expect(progress.first_win).toMatchObject({ count: 1, firstGameId: win1.gameId });
    expect(progress.bounce_back).toMatchObject({ count: 1, firstGameId: win1.gameId });
    expect(progress.first_blitz).toMatchObject({ count: 1, firstGameId: win1.gameId });
    expect(progress.short_fuse).toMatchObject({ count: 2, firstGameId: win1.gameId });
    expect(progress.games_10.count).toBe(0);
  });

  it("awards milestones on the game that crosses them", () => {
    const games = Array.from({ length: 10 }, () =>
      game({ a: [[40, 0], [40, 0]], b: [[0, 0], [0, 0]] }, "a"),
    );
    const progress = byId(computeBadges(games, "a"));
    expect(progress.games_10).toMatchObject({ count: 1, firstGameId: games[9].gameId });
    expect(progress.wins_10).toMatchObject({ count: 1, firstGameId: games[9].gameId });
    expect(progress.blitzes_100.count).toBe(0);
  });

  it("ignores games the player was not in", () => {
    const other = game({ b: [[40, 0], [40, 0]], c: [[0, 5], [0, 5]] }, "b");
    expect(byId(computeBadges([other], "a")).games_10.count).toBe(0);
    expect(computeBadges([other], "a").some((p) => p.count > 0)).toBe(false);
  });
});

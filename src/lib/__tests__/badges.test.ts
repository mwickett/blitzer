import {
  BADGE_FAMILIES,
  BADGES,
  badgesEarnedInGame,
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
    expect(gameMomentBadges(g, "a")).toEqual(["wire_to_wire", "short_fuse", "triple_blitz"]);
    expect(gameMomentBadges(g, "b")).toEqual(["shortcoming"]);
    expect(gameMomentBadges(g, "c")).toEqual([]);
  });

  it("counts a Tornado as a Comeback kid", () => {
    // Alice is alone in last after round 1, 10 behind Bob, who leads alone
    // and then finishes alone in last: a Tornado, short of a 15-point comeback.
    const g = game(
      {
        a: [[0, 0], [40, 0]],
        b: [[10, 0], [0, 10]],
        c: [[5, 0], [10, 0]],
      },
      "a",
    );
    expect(gameMomentBadges(g, "a")).toContain("comeback");
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

  it("credits shared moments to every player who earned them", () => {
    // Round 1: only Alice scores. Round 2: only Bob scores. Bob and Cara
    // both blitz three rounds running, and Cara finishes below zero.
    const g = game(
      {
        a: [[10, 0], [0, 2], [40, 0], [40, 0], [0, 0]],
        b: [[0, 2], [10, 0], [0, 0], [0, 0], [0, 0]],
        c: [[0, 1], [0, 1], [0, 0], [0, 0], [0, 0]],
      },
      "a",
    );
    expect(gameMomentBadges(g, "a")).toContain("snipe");
    expect(gameMomentBadges(g, "b")).toContain("snipe");
    expect(gameMomentBadges(g, "b")).toContain("triple_blitz");
    expect(gameMomentBadges(g, "c")).toContain("triple_blitz");
    expect(gameMomentBadges(g, "c")).toContain("shortcoming");
  });

  it("finds a U-turn by any player, not just the first", () => {
    // Bob goes last to first in round 2; Cara does the same in round 3.
    const g = game(
      {
        a: [[20, 0], [20, 0], [0, 0], [40, 0]],
        b: [[0, 1], [45, 0], [0, 0], [10, 0]],
        c: [[10, 0], [0, 5], [70, 0], [0, 5]],
      },
      "a",
    );
    expect(gameMomentBadges(g, "b")).toContain("u_turn");
    expect(gameMomentBadges(g, "c")).toContain("u_turn");
  });

  it("gives Heartbreaker after a points tie broken on the Blitz pile", () => {
    const g = game(
      {
        a: [[40, 0], [35, 0]],
        b: [[40, 0], [35, 0]],
        c: [[10, 0], [10, 0]],
      },
      "a",
    );
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
    expect(byId(progress).winner).toMatchObject({ tiers: [], total: 0 });
    expect(byId(progress).snipe.total).toBeNull();
  });

  it("dates each badge to the first game that earned it and counts repeats", () => {
    const loss = game({ a: [[10, 3], [10, 3]], b: [[40, 0], [40, 0]] }, "b");
    const win1 = game({ a: [[40, 0], [40, 0]], b: [[10, 3], [10, 3]] }, "a");
    const win2 = game({ a: [[40, 0], [40, 0]], b: [[10, 3], [10, 3]] }, "a");
    // Order of the input doesn't matter.
    const progress = byId(computeBadges([win2, loss, win1], "a"));

    expect(progress.winner).toMatchObject({ count: 1, firstGameId: win1.gameId, total: 2 });
    expect(progress.blitzer).toMatchObject({ count: 1, firstGameId: win1.gameId, total: 4 });
    expect(progress.short_fuse).toMatchObject({ count: 2, firstGameId: win1.gameId });
    expect(progress.regular).toMatchObject({ count: 0, total: 3 });
  });

  it("awards milestone tiers on the game that crosses each one", () => {
    const games = Array.from({ length: 13 }, () =>
      game({ a: [[40, 0], [40, 0]], b: [[0, 0], [0, 0]] }, "a"),
    );
    const progress = byId(computeBadges(games, "a"));
    expect(progress.regular).toMatchObject({ count: 1, firstGameId: games[9].gameId, total: 13 });
    expect(progress.winner).toMatchObject({ count: 2, firstGameId: games[0].gameId });
    expect(progress.winner.tiers.map((t) => t.gameId)).toEqual([games[0].gameId, games[9].gameId]);
    // Two blitzes a game: bronze in game 1, silver in game 13 (26 blitzes).
    expect(progress.blitzer.tiers.map((t) => t.gameId)).toEqual([games[0].gameId, games[12].gameId]);
  });

  it("names the badges and tiers a game earned", () => {
    const games = Array.from({ length: 10 }, () =>
      game({ a: [[40, 0], [40, 0]], b: [[0, 0], [0, 0]] }, "a"),
    );
    const progress = computeBadges(games, "a");
    expect(badgesEarnedInGame(progress, games[0].gameId).map((b) => [b.badge.id, b.tier])).toEqual([
      ["winner", "Bronze"],
      ["blitzer", "Bronze"],
      ["short_fuse", null],
    ]);
    expect(badgesEarnedInGame(progress, games[9].gameId).map((b) => [b.badge.id, b.tier])).toEqual([
      ["winner", "Silver"],
      ["regular", "Bronze"],
    ]);
    expect(badgesEarnedInGame(progress, games[4].gameId)).toEqual([]);
  });

  it("ignores games the player was not in", () => {
    const other = game({ b: [[40, 0], [40, 0]], c: [[0, 5], [0, 5]] }, "b");
    expect(byId(computeBadges([other], "a")).regular).toMatchObject({ count: 0, total: 0 });
    expect(computeBadges([other], "a").some((p) => p.count > 0)).toBe(false);
  });
});

describe("badge catalogue data", () => {
  it("puts every badge in a known family with a how-to-earn rule", () => {
    const families = new Set(BADGE_FAMILIES.map((f) => f.id));
    for (const badge of BADGES) {
      expect(families.has(badge.family)).toBe(true);
      expect(badge.rule.length).toBeGreaterThan(badge.hint.length);
    }
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

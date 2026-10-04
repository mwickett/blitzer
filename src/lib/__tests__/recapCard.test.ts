import { buildRecapCard } from "../scoring/recapCard";
import type { GameDetail } from "@/server/queries/games";

function game(
  rounds: Record<string, [number, number]>[],
  { winThreshold = 75 } = {},
): GameDetail {
  const ids = Object.keys(rounds[0]);
  return {
    id: "game",
    isFinished: true,
    winThreshold,
    endedAt: new Date("2026-10-03T22:00:00Z"),
    players: ids.map((id) => ({
      id: `seat-${id}`,
      userId: id === "guest" ? null : id,
      guestId: id === "guest" ? id : null,
      accentColor: null,
      user: id === "guest" ? null : { username: id, accentColor: null },
      guestUser: id === "guest" ? { name: "Grandpa" } : null,
    })),
    rounds: rounds.map((lines, index) => ({
      id: `r${index}`,
      round: index + 1,
      scores: Object.entries(lines).map(([id, [cards, pile]]) => ({
        userId: id === "guest" ? null : id,
        guestId: id === "guest" ? id : null,
        totalCardsPlayed: cards,
        blitzPileRemaining: pile,
        typedScore: null,
      })),
    })),
  } as unknown as GameDetail;
}

it("returns nothing until someone has won", () => {
  expect(buildRecapCard(game([{ priya: [10, 0], sam: [5, 0] }]))).toBeNull();
});

it("puts the winner first and the rest by score, each with a colour", () => {
  const card = buildRecapCard(
    game([
      { priya: [30, 0], sam: [20, 0], guest: [5, 5] },
      { priya: [30, 0], sam: [25, 0], guest: [2, 6] },
      { priya: [20, 0], sam: [10, 0], guest: [1, 8] },
    ]),
  )!;
  expect(card.winnerName).toBe("priya");
  expect(card.players.map((p) => [p.name, p.score])).toEqual([
    ["priya", 80],
    ["sam", 55],
    ["Grandpa", -30],
  ]);
  expect(new Set(card.players.map((p) => p.color)).size).toBe(3);
  expect(card.roundCount).toBe(3);
});

it("leads with a named moment over other highlights", () => {
  // Three rounds to 75 is a Short fuse, which outranks wire-to-wire.
  const card = buildRecapCard(
    game([
      { priya: [30, 0], sam: [10, 0], guest: [0, 5] },
      { priya: [30, 0], sam: [10, 0], guest: [0, 5] },
      { priya: [20, 0], sam: [10, 0], guest: [0, 5] },
    ]),
  )!;
  expect(card.moment).toEqual({
    title: "Short fuse",
    detail: "priya won in just 3 rounds.",
  });
});

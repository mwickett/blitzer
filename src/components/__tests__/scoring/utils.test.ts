import { findPlayerScore } from "../../scoring/utils";

const scores = [
  { userId: "u1", guestId: null, blitzPileRemaining: 3, totalCardsPlayed: 20 },
  { userId: null, guestId: "g1", blitzPileRemaining: 0, totalCardsPlayed: 15 },
];

describe("findPlayerScore", () => {
  it("matches a registered user by userId", () => {
    const player = { id: "u1", name: "Alice", color: "#3b82f6", isGuest: false, userId: "u1", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBe(scores[0]);
  });

  it("matches a guest user by guestId", () => {
    const player = { id: "g1", name: "Bob", color: "#ef4444", isGuest: true, guestId: "g1", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBe(scores[1]);
  });

  it("returns undefined when no match", () => {
    const player = { id: "u99", name: "Nobody", color: "#eab308", isGuest: false, userId: "u99", score: 0 };
    const result = findPlayerScore(player, scores);
    expect(result).toBeUndefined();
  });
});

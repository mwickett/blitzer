import { calcGameStats, type RoundResult } from "../scoring/gameStats";

const sampleRounds: RoundResult[] = [
  {
    deltas: { p1: 18, p2: 12, p3: 8, p4: -4 },
    blitzCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
  },
  {
    deltas: { p1: 6, p2: 14, p3: 2, p4: -6 },
    blitzCounts: { p1: 0, p2: 1, p3: 0, p4: 0 },
  },
  {
    deltas: { p1: 14, p2: 8, p3: 10, p4: 6 },
    blitzCounts: { p1: 1, p2: 0, p3: 0, p4: 0 },
  },
];

const playerNames: Record<string, string> = {
  p1: "Mike",
  p2: "Sarah",
  p3: "Dan",
  p4: "Jo",
};

describe("calcGameStats", () => {
  it("finds the biggest single round", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.biggestRound.delta).toBe(18);
    expect(stats.biggestRound.playerName).toBe("Mike");
    expect(stats.biggestRound.roundNumber).toBe(1);
  });

  it("finds the worst single round", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.worstRound.delta).toBe(-6);
    expect(stats.worstRound.playerName).toBe("Jo");
    expect(stats.worstRound.roundNumber).toBe(2);
  });

  it("counts total blitzes per player", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.blitzCounts["p1"]).toBe(1);
    expect(stats.blitzCounts["p2"]).toBe(1);
    expect(stats.totalBlitzes).toBe(2);
  });

  it("counts round wins per player", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.roundWins["p1"]).toBe(2);
    expect(stats.roundWins["p2"]).toBe(1);
  });

  it("returns total rounds played", () => {
    const stats = calcGameStats(sampleRounds, playerNames);
    expect(stats.roundsPlayed).toBe(3);
  });
});

import {
  calcWinProbabilities,
  calcProjectedFinishRound,
} from "../scoring/probability";

describe("calcProjectedFinishRound", () => {
  it("projects finish round based on average pace", () => {
    // 50 points in 5 rounds = 10/round, need 75, so ~7.5 → round 8
    expect(calcProjectedFinishRound(50, 5, 75)).toBe(8);
  });

  it("returns Infinity for zero or negative pace", () => {
    expect(calcProjectedFinishRound(-10, 5, 75)).toBe(Infinity);
    expect(calcProjectedFinishRound(0, 5, 75)).toBe(Infinity);
  });

  it("returns current round if already past threshold", () => {
    expect(calcProjectedFinishRound(80, 5, 75)).toBe(5);
  });
});

describe("calcWinProbabilities", () => {
  it("returns null when fewer than 3 rounds played", () => {
    const result = calcWinProbabilities(
      [{ id: "1", score: 10, roundsPlayed: 2 }],
      75
    );
    expect(result).toBeNull();
  });

  it("returns null for empty players", () => {
    expect(calcWinProbabilities([], 75)).toBeNull();
  });

  it("gives higher probability to player with higher pace (no deltas)", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: 20, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["1"]).toBeGreaterThan(result!["2"]);
    const sum = Object.values(result!).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("gives 0% to players with negative pace (no deltas)", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: -10, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["2"]).toBe(0);
    expect(result!["1"]).toBe(100);
  });

  it("returns all zeros when every player has non-positive mean", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: -10, roundsPlayed: 5 },
        { id: "2", score: -20, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["1"]).toBe(0);
    expect(result!["2"]).toBe(0);
  });

  it("is deterministic across calls with same inputs", () => {
    const players = [
      { id: "1", score: 40, roundsPlayed: 5 },
      { id: "2", score: 35, roundsPlayed: 5 },
    ];
    const deltas = {
      "1": [10, 8, 7, 9, 6],
      "2": [5, 12, 3, 8, 7],
    };
    const r1 = calcWinProbabilities(players, 75, deltas);
    const r2 = calcWinProbabilities(players, 75, deltas);
    expect(r1).toEqual(r2);
  });

  describe("with per-round deltas (Monte Carlo)", () => {
    it("accounts for proximity to threshold", () => {
      // Player 1: lower pace but very close to winning (70/75)
      // Player 2: higher pace but far from threshold (30/75)
      const players = [
        { id: "close", score: 70, roundsPlayed: 5 },
        { id: "fast", score: 30, roundsPlayed: 5 },
      ];
      const deltas = {
        close: [12, 14, 16, 14, 14], // mean 14, close to 75
        fast: [4, 8, 6, 6, 6], // mean 6, far from 75
      };
      const result = calcWinProbabilities(players, 75, deltas);
      expect(result).not.toBeNull();
      // Player close to threshold should almost certainly win first
      expect(result!["close"]).toBeGreaterThan(80);
    });

    it("gives volatile player a chance even when behind", () => {
      // Both have same mean, but player 2 is more volatile
      const players = [
        { id: "steady", score: 50, roundsPlayed: 5 },
        { id: "wild", score: 40, roundsPlayed: 5 },
      ];
      const deltas = {
        steady: [10, 10, 10, 10, 10], // consistent
        wild: [-5, 20, 0, 25, 0], // volatile, same-ish mean as steady
      };
      const result = calcWinProbabilities(players, 75, deltas);
      expect(result).not.toBeNull();
      // Wild player should have a non-trivial chance despite being behind
      expect(result!["wild"]).toBeGreaterThan(5);
      expect(result!["steady"]).toBeGreaterThan(result!["wild"]);
    });

    it("sums to 100", () => {
      const players = [
        { id: "1", score: 30, roundsPlayed: 4 },
        { id: "2", score: 25, roundsPlayed: 4 },
        { id: "3", score: 20, roundsPlayed: 4 },
      ];
      const deltas = {
        "1": [8, 7, 9, 6],
        "2": [5, 8, 6, 6],
        "3": [4, 5, 6, 5],
      };
      const result = calcWinProbabilities(players, 75, deltas);
      expect(result).not.toBeNull();
      const sum = Object.values(result!).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    });
  });
});

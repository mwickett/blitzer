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

  it("distributes probability based on scoring pace", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: 20, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["1"]).toBeGreaterThan(result!["2"]);
    // Probabilities should roughly sum to 100
    const sum = Object.values(result!).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it("gives 0% to players with negative pace", () => {
    const result = calcWinProbabilities(
      [
        { id: "1", score: 50, roundsPlayed: 5 },
        { id: "2", score: -10, roundsPlayed: 5 },
      ],
      75
    );
    expect(result).not.toBeNull();
    expect(result!["2"]).toBe(0);
  });
});

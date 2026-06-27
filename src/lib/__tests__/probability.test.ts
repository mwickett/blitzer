import {
  allocateOutcomePercents,
  calcWinProbabilities,
  calcRaceForecast,
  clampRoundScore,
} from "../scoring/probability";

function forecastSum(forecast: NonNullable<ReturnType<typeof calcRaceForecast>>) {
  return (
    Object.values(forecast.players).reduce(
      (sum, player) => sum + player.winProbability,
      0
    ) + forecast.unresolvedProbability
  );
}

describe("clampRoundScore", () => {
  it("keeps simulated round scores inside Dutch Blitz scoring bounds", () => {
    expect(clampRoundScore(-100)).toBe(-20);
    expect(clampRoundScore(100)).toBe(40);
    expect(clampRoundScore(4.6)).toBe(5);
  });
});

describe("allocateOutcomePercents", () => {
  it("uses a stable tie-break when rounded percentages need a remainder bump", () => {
    const counts: [string, number][] = [
      ["b", 2250],
      ["a", 4350],
      ["__unresolved", 3400],
    ];

    expect(allocateOutcomePercents(counts, 10_000)).toEqual({
      a: 44,
      b: 22,
      __unresolved: 34,
    });
    expect(allocateOutcomePercents([...counts].reverse(), 10_000)).toEqual({
      a: 44,
      b: 22,
      __unresolved: 34,
    });
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

  it("is deterministic for the same players in a different order", () => {
    const players = [
      { id: "b", score: 35, roundsPlayed: 5 },
      { id: "a", score: 40, roundsPlayed: 5 },
    ];
    const deltas = {
      a: [10, 8, 7, 9, 6],
      b: [5, 12, 3, 8, 7],
    };
    const original = calcWinProbabilities(players, 75, deltas);
    const reordered = calcWinProbabilities([...players].reverse(), 75, deltas);
    expect(original).toEqual(reordered);
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

describe("calcRaceForecast", () => {
  it("returns null when fewer than 3 rounds have been played", () => {
    expect(
      calcRaceForecast([{ id: "1", score: 10, roundsPlayed: 2 }], 75)
    ).toBeNull();
  });

  it("can use historical profiles for an early low-confidence forecast", () => {
    const forecast = calcRaceForecast(
      [
        { id: "fast", score: 10, roundsPlayed: 1 },
        { id: "steady", score: 10, roundsPlayed: 1 },
      ],
      75,
      {
        fast: [10],
        steady: [10],
      },
      {
        predictionProfiles: {
          fast: {
            playerId: "fast",
            roundsPlayed: 20,
            meanDelta: 18,
            stdDelta: 4,
            blitzRate: 0.6,
            meanCardsPlayed: 24,
            meanBlitzPileRemaining: 3,
            recentDeltas: [20, 18, 16],
          },
          steady: {
            playerId: "steady",
            roundsPlayed: 20,
            meanDelta: 8,
            stdDelta: 3,
            blitzRate: 0.2,
            meanCardsPlayed: 18,
            meanBlitzPileRemaining: 5,
            recentDeltas: [8, 9, 7],
          },
        },
      }
    );

    expect(forecast).not.toBeNull();
    expect(forecast!.usesHistoricalData).toBe(true);
    expect(forecast!.historicalSampleCount).toBe(40);
    expect(forecast!.confidence).toBe("low");
    expect(forecast!.players.fast.winProbability).toBeGreaterThan(
      forecast!.players.steady.winProbability
    );
  });

  it("ignores profiles without enough history for an early forecast", () => {
    const forecast = calcRaceForecast(
      [
        { id: "fast", score: 10, roundsPlayed: 1 },
        { id: "steady", score: 10, roundsPlayed: 1 },
      ],
      75,
      {
        fast: [10],
        steady: [10],
      },
      {
        predictionProfiles: {
          fast: {
            playerId: "fast",
            roundsPlayed: 4,
            meanDelta: 18,
            stdDelta: 4,
            blitzRate: 0.6,
            meanCardsPlayed: 24,
            meanBlitzPileRemaining: 3,
            recentDeltas: [20, 18, 16],
          },
        },
      }
    );

    expect(forecast).toBeNull();
  });

  it("does not mark shallow per-player history as high confidence", () => {
    const forecast = calcRaceForecast(
      [
        { id: "a", score: 50, roundsPlayed: 5 },
        { id: "b", score: 45, roundsPlayed: 5 },
        { id: "c", score: 40, roundsPlayed: 5 },
        { id: "d", score: 35, roundsPlayed: 5 },
      ],
      75,
      {
        a: [10, 10, 10, 10, 10],
        b: [9, 9, 9, 9, 9],
        c: [8, 8, 8, 8, 8],
        d: [7, 7, 7, 7, 7],
      },
      {
        predictionProfiles: Object.fromEntries(
          ["a", "b", "c", "d"].map((id, index) => [
            id,
            {
              playerId: id,
              roundsPlayed: 5,
              meanDelta: 10 - index,
              stdDelta: 1,
              blitzRate: 0.4,
              meanCardsPlayed: 20,
              meanBlitzPileRemaining: 4,
              recentDeltas: [10 - index],
            },
          ])
        ),
      }
    );

    expect(forecast).not.toBeNull();
    expect(forecast!.historicalSampleCount).toBe(20);
    expect(forecast!.confidence).not.toBe("high");
  });

  it("keeps unresolved simulations explicit instead of crediting the leader", () => {
    const forecast = calcRaceForecast(
      [
        { id: "leader", score: 3, roundsPlayed: 3 },
        { id: "trailing", score: 0, roundsPlayed: 3 },
      ],
      75,
      {
        leader: [1, 1, 1],
        trailing: [0, 0, 0],
      }
    );

    expect(forecast).not.toBeNull();
    expect(forecast!.players.leader.winProbability).toBe(0);
    expect(forecast!.unresolvedProbability).toBe(100);
    expect(forecast!.gameEndRound).toBeNull();
    expect(forecastSum(forecast!)).toBe(100);
  });

  it("derives next-round threat and winning-round range from the same pass", () => {
    const forecast = calcRaceForecast(
      [
        { id: "close", score: 70, roundsPlayed: 5 },
        { id: "far", score: 30, roundsPlayed: 5 },
      ],
      75,
      {
        close: [12, 14, 16, 14, 14],
        far: [4, 8, 6, 6, 6],
      }
    );

    expect(forecast).not.toBeNull();
    expect(forecast!.players.close.nextRoundWinProbability).toBeGreaterThan(90);
    expect(forecast!.players.close.nextRoundWinProbability).toBeLessThanOrEqual(
      forecast!.players.close.winProbability
    );
    expect(forecast!.players.close.winningRound?.median).toBe(6);
    expect(forecast!.gameEndRound?.median).toBe(6);
  });

  it("returns player outcomes plus unresolved outcomes that sum to 100", () => {
    const forecast = calcRaceForecast(
      [
        { id: "1", score: 30, roundsPlayed: 4 },
        { id: "2", score: 25, roundsPlayed: 4 },
        { id: "3", score: 20, roundsPlayed: 4 },
      ],
      75,
      {
        "1": [8, 7, 9, 6],
        "2": [5, 8, 6, 6],
        "3": [4, 5, 6, 5],
      }
    );

    expect(forecast).not.toBeNull();
    expect(forecastSum(forecast!)).toBe(100);
  });
});

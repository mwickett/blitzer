import { buildRoundGraphSeries } from "../../scoring/roundGraphSeries";
import { type PlayerWithScore, type RoundData } from "../../scoring/types";

const players: PlayerWithScore[] = [
  {
    id: "p1",
    name: "Alice",
    color: "#ff0000",
    isGuest: false,
    userId: "u1",
    score: 40,
  },
  {
    id: "p2",
    name: "Bob",
    color: "#0000ff",
    isGuest: true,
    guestId: "g1",
    score: 5,
  },
];

const rounds: RoundData[] = [
  {
    id: "r1",
    revision: 0,
    scores: [
      // Alice: 30 - 0*2 = 30
      { userId: "u1", blitzPileRemaining: 0, totalCardsPlayed: 30 },
      // Bob: 20 - 5*2 = 10
      { guestId: "g1", blitzPileRemaining: 5, totalCardsPlayed: 20 },
    ],
  },
  {
    id: "r2",
    revision: 0,
    scores: [
      // Alice: 20 - 5*2 = 10 → cumulative 40
      { userId: "u1", blitzPileRemaining: 5, totalCardsPlayed: 20 },
      // Bob: 10 - 5*2 = 0 → cumulative 10; missing guest match → 0 if wrong id
      { guestId: "g1", blitzPileRemaining: 5, totalCardsPlayed: 10 },
    ],
  },
];

describe("buildRoundGraphSeries", () => {
  it("builds cumulative scores, deltas, and round samples per player", () => {
    const { scoresByRound, deltasByRound, roundSamplesByPlayer } =
      buildRoundGraphSeries(players, rounds);

    expect(deltasByRound.p1).toEqual([30, 10]);
    expect(deltasByRound.p2).toEqual([10, 0]);
    expect(scoresByRound.p1).toEqual([30, 40]);
    expect(scoresByRound.p2).toEqual([10, 10]);
    expect(roundSamplesByPlayer.p1).toEqual([
      { totalCardsPlayed: 30, blitzPileRemaining: 0 },
      { totalCardsPlayed: 20, blitzPileRemaining: 5 },
    ]);
    expect(roundSamplesByPlayer.p2).toHaveLength(2);
  });

  it("treats missing player scores as zero delta without samples", () => {
    const incomplete: RoundData[] = [
      {
        id: "r1",
        revision: 0,
        scores: [{ userId: "u1", blitzPileRemaining: 0, totalCardsPlayed: 10 }],
      },
    ];
    const { scoresByRound, deltasByRound, roundSamplesByPlayer } =
      buildRoundGraphSeries(players, incomplete);

    expect(deltasByRound.p1).toEqual([10]);
    expect(deltasByRound.p2).toEqual([0]);
    expect(scoresByRound.p2).toEqual([0]);
    expect(roundSamplesByPlayer.p2).toEqual([]);
  });
});

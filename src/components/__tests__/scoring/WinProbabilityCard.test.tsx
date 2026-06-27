import { render, screen } from "@testing-library/react";
import { WinProbabilityCard } from "../../scoring/graphs/WinProbabilityCard";
import { type PlayerWithScore } from "../../scoring/types";

const players: PlayerWithScore[] = [
  {
    id: "close",
    name: "Alice",
    color: "#ff0000",
    isGuest: false,
    userId: "close",
    score: 70,
  },
  {
    id: "far",
    name: "Bob",
    color: "#0000ff",
    isGuest: false,
    userId: "far",
    score: 30,
  },
];

describe("WinProbabilityCard", () => {
  it("shows an unavailable state before enough current-game rounds", () => {
    render(
      <WinProbabilityCard
        players={players}
        roundsPlayed={2}
        winThreshold={75}
      />
    );

    expect(screen.getByText("Available after 3 rounds")).toBeInTheDocument();
  });

  it("renders the race outlook instead of the old projected finish section", () => {
    render(
      <WinProbabilityCard
        players={players}
        roundsPlayed={5}
        winThreshold={75}
          deltasByPlayer={{
            close: [12, 14, 16, 14, 14],
            far: [4, 8, 6, 6, 6],
          }}
          roundSamplesByPlayer={{
            close: [
              { totalCardsPlayed: 22, blitzPileRemaining: 5 },
              { totalCardsPlayed: 24, blitzPileRemaining: 5 },
              { totalCardsPlayed: 26, blitzPileRemaining: 5 },
              { totalCardsPlayed: 24, blitzPileRemaining: 5 },
              { totalCardsPlayed: 24, blitzPileRemaining: 5 },
            ],
            far: [
              { totalCardsPlayed: 14, blitzPileRemaining: 5 },
              { totalCardsPlayed: 18, blitzPileRemaining: 5 },
              { totalCardsPlayed: 16, blitzPileRemaining: 5 },
              { totalCardsPlayed: 16, blitzPileRemaining: 5 },
              { totalCardsPlayed: 16, blitzPileRemaining: 5 },
            ],
          }}
          predictionProfiles={{
            close: {
              playerId: "close",
              roundsPlayed: 12,
              meanDelta: 14,
              stdDelta: 2,
              blitzRate: 0.5,
              meanCardsPlayed: 24,
              meanBlitzPileRemaining: 5,
              recentDeltas: [12, 14, 16],
            },
            far: {
              playerId: "far",
              roundsPlayed: 12,
              meanDelta: 6,
              stdDelta: 2,
              blitzRate: 0.2,
              meanCardsPlayed: 18,
              meanBlitzPileRemaining: 6,
              recentDeltas: [4, 8, 6],
            },
          }}
        />
      );

    expect(screen.getByText("Race Outlook")).toBeInTheDocument();
    expect(screen.getByText("Likely ending")).toBeInTheDocument();
    expect(screen.getByText("Next-round danger")).toBeInTheDocument();
    expect(screen.getByText("Blitz-out path")).toBeInTheDocument();
    expect(screen.getByText("20+ pt swing")).toBeInTheDocument();
    expect(screen.getByText(/Blitz-out threat/)).toBeInTheDocument();
    expect(
      screen.getByText("History-backed from 24 prior player scores")
    ).toBeInTheDocument();
    expect(screen.queryByText("Projected finish")).not.toBeInTheDocument();
  });
});

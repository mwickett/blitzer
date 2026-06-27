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
      />
    );

    expect(screen.getByText("Race Outlook")).toBeInTheDocument();
    expect(screen.getByText("Likely ending")).toBeInTheDocument();
    expect(screen.getByText("Next-round danger")).toBeInTheDocument();
    expect(screen.getByText(/Can close now/)).toBeInTheDocument();
    expect(screen.queryByText("Projected finish")).not.toBeInTheDocument();
  });
});

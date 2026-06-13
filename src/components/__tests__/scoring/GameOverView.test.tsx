import { render, screen, fireEvent } from "@testing-library/react";
import { GameOverView } from "../../scoring/GameOverView";
import { type PlayerWithScore } from "../../scoring/types";
import { type GameStats } from "@/lib/scoring/gameStats";

jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: jest.fn() }),
}));

const players: PlayerWithScore[] = [
  { id: "p1", name: "Alice", color: "#ff0000", isGuest: false, userId: "p1", score: 80 },
  { id: "p2", name: "Bob", color: "#0000ff", isGuest: false, userId: "p2", score: 40 },
];

const stats: GameStats = {
  roundsPlayed: 3,
  roundWins: { p1: 2, p2: 1 },
  blitzCounts: { p1: 2, p2: 0 },
  biggestRound: { delta: 30, playerName: "Alice", roundNumber: 2 },
  worstRound: { delta: -12, playerName: "Bob", roundNumber: 1 },
  totalBlitzes: 2,
};

const rounds = [
  {
    id: "r1",
    scores: [
      { userId: "p1", blitzPileRemaining: 0, totalCardsPlayed: 30 },
      { userId: "p2", blitzPileRemaining: 5, totalCardsPlayed: 20 },
    ],
  },
];

const baseProps = {
  winner: players[0],
  players,
  stats,
  rounds,
  onRematch: jest.fn(),
  onBackToCircle: jest.fn(),
};

describe("GameOverView spectator mode", () => {
  it("shows member actions by default (interactive)", () => {
    render(<GameOverView {...baseProps} />);
    // Winner name appears in both the winner card and the standings row
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(
      screen.getByText("New Game with Same Players")
    ).toBeInTheDocument();
    expect(screen.getByText("Back to Circle")).toBeInTheDocument();
  });

  it("hides member actions when read-only (canEdit=false)", () => {
    render(<GameOverView {...baseProps} canEdit={false} />);
    // Result is still shown to spectators
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByText("Game Complete")).toBeInTheDocument();
    // ...but no mutating actions
    expect(
      screen.queryByText("New Game with Same Players")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Back to Circle")).not.toBeInTheDocument();
  });
});

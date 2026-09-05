import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GameOverView } from "../../scoring/GameOverView";
import { type PlayerWithScore } from "../../scoring/types";
import { type GameStats } from "@/lib/scoring/gameStats";

const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

const players: PlayerWithScore[] = [
  {
    id: "p1",
    name: "Alice",
    color: "#ff0000",
    isGuest: false,
    userId: "p1",
    score: 80,
  },
  {
    id: "p2",
    name: "Bob",
    color: "#0000ff",
    isGuest: false,
    userId: "p2",
    score: 40,
  },
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
    revision: 0,
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
  onBackToGames: jest.fn(),
};

describe("GameOverView spectator mode", () => {
  beforeEach(() => mockCapture.mockReset());

  it("creates a rematch even when optional analytics throws", async () => {
    mockCapture.mockImplementation(() => { throw new Error("Analytics unavailable"); });
    const onRematch = jest.fn().mockResolvedValue(undefined);
    render(<GameOverView {...baseProps} onRematch={onRematch} />);
    fireEvent.click(screen.getByRole("button", { name: "New Game with Same Players" }));
    await waitFor(() => expect(onRematch).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns to games even when optional analytics throws", () => {
    mockCapture.mockImplementation(() => { throw new Error("Analytics unavailable"); });
    const onBackToGames = jest.fn();
    render(<GameOverView {...baseProps} onBackToGames={onBackToGames} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to Games" }));
    expect(onBackToGames).toHaveBeenCalledTimes(1);
  });

  it("shows member actions by default (interactive)", () => {
    render(<GameOverView {...baseProps} />);
    // Winner name appears in both the winner card and the standings row
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByText("New Game with Same Players")).toBeInTheDocument();
    expect(screen.getByText("Back to Games")).toBeInTheDocument();
  });

  it("hides member actions when read-only (canEdit=false)", () => {
    render(<GameOverView {...baseProps} canEdit={false} />);
    // Result is still shown to spectators
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getByText("Game Complete")).toBeInTheDocument();
    // ...but no mutating actions
    expect(
      screen.queryByText("New Game with Same Players"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Back to Games")).not.toBeInTheDocument();
  });

  it("keeps navigation but hides rematch when the game cannot be cloned", () => {
    render(<GameOverView {...baseProps} canRematch={false} />);
    expect(
      screen.queryByText("New Game with Same Players"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Back to Games")).toBeInTheDocument();
  });

  it("creates one rematch and stays disabled while the new game opens", async () => {
    let finish!: () => void;
    const onRematch = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<GameOverView {...baseProps} onRematch={onRematch} />);
    const button = screen.getByRole("button", { name: "New Game with Same Players" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => { finish(); });
    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to Games" })).toBeDisabled();
  });

  it("surfaces a failed rematch and allows retry", async () => {
    const onRematch = jest.fn().mockRejectedValueOnce(new Error("Network failure")).mockResolvedValue(undefined);
    render(<GameOverView {...baseProps} onRematch={onRematch} />);
    fireEvent.click(screen.getByRole("button", { name: "New Game with Same Players" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    fireEvent.click(screen.getByRole("button", { name: "New Game with Same Players" }));
    await waitFor(() => expect(onRematch).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

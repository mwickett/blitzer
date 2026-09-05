import { fireEvent, render, screen } from "@testing-library/react";
import { BetweenRoundsView } from "../../scoring/BetweenRoundsView";
import { type PlayerWithScore } from "../../scoring/types";

// Stub the heavy visual children — they pull in recharts and aren't part of
// the behavior under test (CTA + edit affordance gating). FloatingCTA and
// RoundHistoryTable stay real because they're the gated elements.
jest.mock("../../scoring/RaceTrack", () => ({ RaceTrack: () => <div /> }));
jest.mock("../../scoring/Standings", () => ({ Standings: () => <div /> }));
jest.mock("../../scoring/GraphCarousel", () => ({
  GraphCarousel: () => <div />,
}));
jest.mock("../../scoring/graphs/ScoreProgressionCard", () => ({
  ScoreProgressionCard: () => <div />,
}));
jest.mock("../../scoring/graphs/HotColdCard", () => ({
  HotColdCard: () => <div />,
}));
jest.mock("../../scoring/graphs/WinProbabilityCard", () => ({
  WinProbabilityCard: () => <div />,
}));
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
    score: 30,
  },
  {
    id: "p2",
    name: "Bob",
    color: "#0000ff",
    isGuest: false,
    userId: "p2",
    score: 10,
  },
];

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
  players,
  rounds,
  winThreshold: 75,
  nextRoundNumber: 2,
  onEnterScores: jest.fn(),
  onEditRound: jest.fn(),
};

describe("BetweenRoundsView spectator mode", () => {
  beforeEach(() => mockCapture.mockReset());

  it("opens score entry even when optional analytics throws", () => {
    mockCapture.mockImplementation(() => { throw new Error("Analytics unavailable"); });
    const onEnterScores = jest.fn();
    render(<BetweenRoundsView {...baseProps} onEnterScores={onEnterScores} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter Round 2 Scores" }));
    expect(onEnterScores).toHaveBeenCalledTimes(1);
  });

  it("shows the enter-scores CTA and edit affordance by default", () => {
    render(<BetweenRoundsView {...baseProps} />);
    expect(screen.getByText(/Enter Round 2 Scores/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit round 1" }),
    ).toBeInTheDocument();
  });

  it("hides the CTA and edit affordance when read-only (canEdit=false)", () => {
    render(<BetweenRoundsView {...baseProps} canEdit={false} />);
    // Standings/history still render (read-only), but no way to act
    expect(screen.queryByText(/Enter Round 2 Scores/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit round 1" }),
    ).not.toBeInTheDocument();
  });
});

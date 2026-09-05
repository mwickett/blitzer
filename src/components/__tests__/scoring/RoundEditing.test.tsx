import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScoringShell } from "../../scoring/ScoringShell";
import { type PlayerWithScore, type RoundData } from "../../scoring/types";
import { updateRoundScores } from "@/server/mutations/rounds";

// Keep both editor mounts, the editing hook, and the history controls real.
// Visualizations and server actions are outside this component regression.
jest.mock("../../scoring/RaceTrack", () => ({ RaceTrack: () => null }));
jest.mock("../../scoring/Standings", () => ({ Standings: () => null }));
jest.mock("../../scoring/GraphCarousel", () => ({ GraphCarousel: () => null }));
jest.mock("../../scoring/graphs/ScoreProgressionCard", () => ({
  ScoreProgressionCard: () => null,
}));
jest.mock("../../scoring/graphs/HotColdCard", () => ({ HotColdCard: () => null }));
jest.mock("../../scoring/graphs/WinProbabilityCard", () => ({
  WinProbabilityCard: () => null,
}));
jest.mock("../../scoring/ScoreEntryView", () => ({ ScoreEntryView: () => null }));
jest.mock("../../scoring/CelebrationOverlay", () => ({
  CelebrationOverlay: () => null,
}));
jest.mock("@/server/mutations/games", () => ({ cloneGame: jest.fn() }));
jest.mock("@/server/mutations/rounds", () => ({ updateRoundScores: jest.fn() }));
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: jest.fn() }),
}));

const players: PlayerWithScore[] = [
  { id: "alice", userId: "alice", name: "Alice", color: "#ff0000", isGuest: false, score: 30 },
  { id: "bob", guestId: "bob", name: "Bob", color: "#0000ff", isGuest: true, score: 30 },
];

const rounds: RoundData[] = [
  {
    id: "round-1",
    scores: [
      { userId: "alice", blitzPileRemaining: 0, totalCardsPlayed: 30 },
      { guestId: "bob", blitzPileRemaining: 5, totalCardsPlayed: 20 },
    ],
  },
  {
    id: "round-2",
    scores: [
      { userId: "alice", blitzPileRemaining: 5, totalCardsPlayed: 10 },
      { guestId: "bob", blitzPileRemaining: 0, totalCardsPlayed: 20 },
    ],
  },
];

const baseProps = {
  gameId: "game-1",
  players,
  rounds,
  winThreshold: 30,
  currentRoundNumber: 3,
  winnerId: "bob",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(updateRoundScores).mockResolvedValue([]);
});

describe.each([
  ["ongoing game", false],
  ["finished game", true],
] as const)("%s round editing", (_label, isFinished) => {
  it("switches the displayed and saved draft to the newly selected round", async () => {
    render(<ScoringShell {...baseProps} isFinished={isFinished} />);

    fireEvent.click(screen.getAllByLabelText("Edit round")[0]);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "35" } });
    fireEvent.click(screen.getAllByLabelText("Edit round")[1]);

    expect(screen.getByText("Edit Round 2")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value))
      .toEqual(["5", "10", "0", "20"]);

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(updateRoundScores).toHaveBeenCalledWith(
      "game-1", "round-2", rounds[1].scores,
    ));
    await waitFor(() => expect(screen.queryByText("Edit Round 2")).not.toBeInTheDocument());
  });

  it("preserves an open draft when the same persisted round refreshes", async () => {
    const { rerender } = render(<ScoringShell {...baseProps} isFinished={isFinished} />);
    fireEvent.click(screen.getAllByLabelText("Edit round")[1]);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "19" } });

    const refreshedRounds = rounds.map((round) => ({
      ...round,
      scores: round.scores.map((score) => ({ ...score, totalCardsPlayed: 11 })),
    }));
    rerender(<ScoringShell {...baseProps} isFinished={isFinished} rounds={refreshedRounds} />);

    expect(screen.getAllByRole("textbox")[1]).toHaveValue("19");
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(updateRoundScores).toHaveBeenCalledWith(
      "game-1", "round-2", [
        { userId: "alice", blitzPileRemaining: 5, totalCardsPlayed: 19 },
        rounds[1].scores[1],
      ],
    ));
    await waitFor(() => expect(screen.queryByText("Edit Round 2")).not.toBeInTheDocument());
  });

  it("resets the draft if the persisted round changes at the same position", () => {
    const { rerender } = render(<ScoringShell {...baseProps} isFinished={isFinished} />);
    fireEvent.click(screen.getAllByLabelText("Edit round")[1]);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "19" } });

    rerender(<ScoringShell {...baseProps} isFinished={isFinished} rounds={[
      rounds[0],
      { id: "replacement-round", scores: rounds[0].scores },
    ]} />);

    expect(screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value))
      .toEqual(["0", "30", "5", "20"]);
  });
});

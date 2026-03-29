import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScoreEntryView } from "../../scoring/ScoreEntryView";

// Mock crypto.randomUUID for jsdom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "test-uuid-1234" },
  });
}

// Mock server actions
jest.mock("@/server/mutations", () => ({
  createRoundForGame: jest.fn().mockResolvedValue({ id: "round-1" }),
  deleteLatestRound: jest.fn().mockResolvedValue({ deletedRoundNumber: 1 }),
}));

// Mock posthog-js/react
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    capture: jest.fn(),
  }),
}));

// Mock game rules — keep real logic
jest.mock("@/lib/validation/gameRules", () => ({
  GAME_RULES: {
    MAX_BLITZ_PILE: 10,
    MAX_CARDS_PLAYED: 40,
    BLITZ_PENALTY_MULTIPLIER: 2,
    POINTS_TO_WIN: 75,
    MIN_CARDS_FOR_BLITZ: 4,
  },
  validateGameRules: jest.fn(),
  calculateRoundScore: jest.fn(
    (s: { blitzPileRemaining: number; totalCardsPlayed: number }) =>
      s.totalCardsPlayed - 2 * s.blitzPileRemaining
  ),
}));

const mockPlayers = [
  {
    id: "1",
    name: "Mike",
    color: "#3b82f6",
    isGuest: false,
    userId: "u1",
    score: 0,
  },
  {
    id: "2",
    name: "Sarah",
    color: "#ef4444",
    isGuest: false,
    userId: "u2",
    score: 0,
  },
];

describe("ScoreEntryView", () => {
  it("renders player cards with names", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    // Names appear in both RaceTrack pills and ScoreEntryCards, so use getAllByText
    expect(screen.getAllByText("Mike").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sarah").length).toBeGreaterThanOrEqual(1);
  });

  it("shows remaining count in submit button area", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    expect(screen.getByText(/2 remaining/)).toBeInTheDocument();
  });

  it("updates remaining count when fields are filled", () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );
    const inputs = screen.getAllByPlaceholderText("—");
    // Fill Mike's two fields
    fireEvent.change(inputs[0], { target: { value: "3" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    expect(screen.getByText(/1 remaining/)).toBeInTheDocument();
  });

  it("shows undo toast after submit", async () => {
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />
    );

    // Fill all inputs (2 per player = 4 total)
    const inputs = screen.getAllByPlaceholderText("—");
    fireEvent.change(inputs[0], { target: { value: "0" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    fireEvent.change(inputs[2], { target: { value: "5" } });
    fireEvent.change(inputs[3], { target: { value: "14" } });

    // Submit
    const submitBtn = screen.getByText("Submit Round");
    fireEvent.click(submitBtn);

    // Undo toast should appear
    await waitFor(() => {
      expect(screen.getByText("Round 1 submitted")).toBeInTheDocument();
      expect(screen.getByText("Undo")).toBeInTheDocument();
    });
  });
});

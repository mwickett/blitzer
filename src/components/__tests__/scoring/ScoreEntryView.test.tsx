import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createRoundForGame } from "@/server/mutations";
import { ScoreEntryView } from "../../scoring/ScoreEntryView";

// Mock crypto.randomUUID for jsdom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "test-uuid-1234" },
  });
}

// Mock server actions
jest.mock("@/server/mutations", () => ({
  createRoundForGame: jest
    .fn()
    .mockResolvedValue({ ok: true, round: { id: "round-1" } }),
}));

// Mock next/navigation router
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
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
      s.totalCardsPlayed - 2 * s.blitzPileRemaining,
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
      />,
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
      />,
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
      />,
    );
    const inputs = screen.getAllByPlaceholderText("—");
    // Fill Mike's two fields
    fireEvent.change(inputs[0], { target: { value: "3" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    expect(screen.getByText(/1 remaining/)).toBeInTheDocument();
  });

  it("calls router.replace to the current game after successful submit", async () => {
    mockReplace.mockClear();
    render(
      <ScoreEntryView
        gameId="game-1"
        currentRoundNumber={1}
        players={mockPlayers}
        winThreshold={75}
      />,
    );

    // Fill all inputs (2 per player = 4 total)
    const inputs = screen.getAllByPlaceholderText("—");
    fireEvent.change(inputs[0], { target: { value: "0" } });
    fireEvent.change(inputs[1], { target: { value: "18" } });
    fireEvent.change(inputs[2], { target: { value: "5" } });
    fireEvent.change(inputs[3], { target: { value: "14" } });

    fireEvent.click(screen.getByText("Submit Round"));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/games/game-1"),
    );
  });
  it("passes the persisted round ID and revision into the scoring shell", async () => {
    const round = { id: "saved-round", revision: 3, scores: [] };
    (createRoundForGame as jest.Mock).mockResolvedValueOnce({ ok: true, round });
    const onRoundSubmitted = jest.fn();
    render(<ScoreEntryView gameId="game-1" currentRoundNumber={1} players={mockPlayers} winThreshold={75} onRoundSubmitted={onRoundSubmitted} />);
    const inputs = screen.getAllByPlaceholderText("—");
    [0, 18, 5, 14].forEach((value, index) => fireEvent.change(inputs[index], { target: { value: String(value) } }));
    fireEvent.click(screen.getByText("Submit Round"));
    await waitFor(() => expect(onRoundSubmitted).toHaveBeenCalledWith(round));
  });
});

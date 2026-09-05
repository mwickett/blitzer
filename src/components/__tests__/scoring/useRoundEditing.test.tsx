import { act, renderHook } from "@testing-library/react";
import { useRoundEditing } from "@/components/scoring/useRoundEditing";
import { updateRoundScores } from "@/server/mutations/rounds";
import type { PlayerWithScore, RoundData } from "@/components/scoring/types";

const mockRefresh = jest.fn();
const mockCapture = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));
jest.mock("@/server/mutations/rounds", () => ({
  updateRoundScores: jest.fn(),
}));

const players: PlayerWithScore[] = [
  {
    id: "player",
    userId: "player",
    name: "Player",
    color: "#000000",
    isGuest: false,
    score: 0,
  },
  {
    id: "guest",
    guestId: "guest",
    name: "Guest",
    color: "#ffffff",
    isGuest: true,
    score: 0,
  },
];
const draft = {
  player: { totalCardsPlayed: 30, blitzPileRemaining: 0 },
  guest: { totalCardsPlayed: 20, blitzPileRemaining: 5 },
};
const round: RoundData = { id: "round", revision: 0, scores: [] };

beforeEach(() => jest.clearAllMocks());

it("saves against the revision captured when editing began after refreshed props arrive", async () => {
  (updateRoundScores as jest.Mock).mockResolvedValue({
    ok: false,
    reason: "round_conflict",
    message: "Review the latest scores.",
  });
  const { result, rerender } = renderHook(
    ({ rounds }) => useRoundEditing({ gameId: "game", rounds, players }),
    { initialProps: { rounds: [round] } },
  );
  act(() => result.current.handleEditRound(0));
  rerender({ rounds: [{ ...round, revision: 1 }] });
  // Re-selecting the open row must not silently rebase its existing draft.
  act(() => result.current.handleEditRound(0));
  await act(async () => result.current.handleSaveEdit(draft));
  expect(updateRoundScores).toHaveBeenCalledWith(
    "game",
    "round",
    [
      { userId: "player", ...draft.player },
      { guestId: "guest", ...draft.guest },
    ],
    0,
  );
  expect(result.current.editingRoundIndex).toBe(0);
  expect(result.current.editError).toBe("Review the latest scores.");
  expect(mockRefresh).not.toHaveBeenCalled();
});

it("closes the editor and refreshes only after a successful persisted edit", async () => {
  (updateRoundScores as jest.Mock).mockResolvedValue({
    ok: true,
    round: { ...round, revision: 1 },
  });
  const { result } = renderHook(() =>
    useRoundEditing({ gameId: "game", rounds: [round], players }),
  );
  act(() => result.current.handleEditRound(0));
  await act(async () => result.current.handleSaveEdit(draft));
  expect(result.current.editingRoundIndex).toBeNull();
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

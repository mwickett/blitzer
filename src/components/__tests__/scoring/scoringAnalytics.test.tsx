import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { GraphCarousel } from "../../scoring/GraphCarousel";
import { newRoundDraft, useScoringDraft } from "../../scoring/useScoringDraft";
import { type PlayerWithScore, type RoundData } from "../../scoring/types";
import {
  createRoundForGame,
  updateRoundScores,
} from "@/server/mutations/rounds";

const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));
jest.mock("@/server/mutations/rounds", () => ({
  createRoundForGame: jest.fn(),
  updateRoundScores: jest.fn(),
}));

const players: PlayerWithScore[] = [
  { id: "a", userId: "a", name: "A", color: "#000", isGuest: false, score: 0 },
  { id: "g", guestId: "g", name: "G", color: "#111", isGuest: true, score: 0 },
];
const savedRound: RoundData = {
  id: "r1",
  revision: 0,
  scores: [
    { userId: "a", blitzPileRemaining: 0, totalCardsPlayed: 20 },
    { guestId: "g", blitzPileRemaining: 3, totalCardsPlayed: 10 },
  ],
};

function fill(result: { current: ReturnType<typeof useScoringDraft> }) {
  act(() => {
    result.current.update("a", "blitzRemaining", 0);
    result.current.update("a", "cardsPlayed", 20);
    result.current.update("g", "blitzRemaining", 3);
    result.current.update("g", "cardsPlayed", 10);
  });
}

describe("scoring draft analytics", () => {
  beforeEach(() => {
    mockCapture.mockReset();
    jest.mocked(createRoundForGame).mockReset();
    jest.mocked(updateRoundScores).mockReset();
  });

  it("reports entry time from the first value typed, not from opening", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000);
    jest
      .mocked(createRoundForGame)
      .mockResolvedValue({ ok: true, round: savedRound } as never);
    const { result } = renderHook(() =>
      useScoringDraft("game-1", () => newRoundDraft(players, 1), jest.fn()),
    );
    now.mockReturnValue(50_000);
    fill(result);
    now.mockReturnValue(62_500);
    await act(() => result.current.submit());

    expect(mockCapture).toHaveBeenCalledWith("scoring_round_submitted", {
      game_id: "game-1",
      round_number: 1,
      player_count: 2,
      entry_duration_ms: 12_500,
    });
    now.mockRestore();
  });

  it("records conflicts and cancelled edits", async () => {
    jest.mocked(updateRoundScores).mockResolvedValue({
      ok: false,
      reason: "stale_round",
      message: "Someone else changed this round.",
    });
    const { result } = renderHook(() =>
      useScoringDraft("game-1", () => null, jest.fn()),
    );
    act(() => result.current.edit(players, savedRound, 1));
    await act(() => result.current.submit());
    expect(mockCapture).toHaveBeenCalledWith("scoring_round_conflict", {
      game_id: "game-1",
      round_number: 1,
      is_edit: true,
      reason: "stale_round",
    });

    act(() => result.current.cancel());
    expect(mockCapture).toHaveBeenCalledWith("scoring_round_edit_cancelled", {
      game_id: "game-1",
      round_number: 1,
      had_conflict: true,
    });
  });

  it("still saves when analytics throws", async () => {
    mockCapture.mockImplementation(() => {
      throw new Error("blocked");
    });
    const onSaved = jest.fn();
    jest
      .mocked(createRoundForGame)
      .mockResolvedValue({ ok: true, round: savedRound } as never);
    const { result } = renderHook(() =>
      useScoringDraft("game-1", () => newRoundDraft(players, 1), onSaved),
    );
    fill(result);
    await act(() => result.current.submit());
    expect(onSaved).toHaveBeenCalledWith(savedRound);
    expect(result.current.error).toBeNull();
  });
});

describe("GraphCarousel analytics", () => {
  beforeEach(() => mockCapture.mockReset());

  it("reports each swiped-to graph once per view", () => {
    const { container } = render(
      <GraphCarousel
        context="between_rounds"
        graphNames={["score_progression", "hot_cold"]}
      >
        <div>One</div>
        <div>Two</div>
      </GraphCarousel>,
    );
    const scroller = container.querySelector(".overflow-x-auto") as HTMLElement;
    const firstCard = scroller.firstElementChild as HTMLElement;
    Object.defineProperty(firstCard, "offsetWidth", { value: 300 });

    scroller.scrollLeft = -400; // elastic overscroll past the first card
    fireEvent.scroll(scroller);
    scroller.scrollLeft = 312;
    fireEvent.scroll(scroller);
    scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    scroller.scrollLeft = 312;
    fireEvent.scroll(scroller);

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("scoring_graph_viewed", {
      graph: "hot_cold",
      position: 1,
      context: "between_rounds",
    });
  });
});

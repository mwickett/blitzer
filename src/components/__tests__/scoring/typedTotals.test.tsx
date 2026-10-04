import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { EntryModeToggle } from "../../scoring/EntryModeToggle";
import { RoundHistoryTable } from "../../scoring/RoundHistoryTable";
import { ScoreEntryCard } from "../../scoring/ScoreEntryCard";
import { buildRoundGraphSeries } from "../../scoring/roundGraphSeries";
import { newRoundDraft, useScoringDraft } from "../../scoring/useScoringDraft";
import {
  getEntryStatus,
  type EntryMode,
  type PlayerEntry,
  type PlayerWithScore,
  type RoundData,
} from "../../scoring/types";
import { createRoundForGame } from "@/server/mutations/rounds";

const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));
jest.mock("@/server/mutations/rounds", () => ({
  createRoundForGame: jest.fn(),
  updateRoundScores: jest.fn(),
}));

const players: PlayerWithScore[] = [
  {
    id: "a",
    userId: "a",
    name: "Ann",
    color: "#000",
    isGuest: false,
    score: 0,
  },
  {
    id: "g",
    guestId: "g",
    name: "Gus",
    color: "#111",
    isGuest: true,
    score: 0,
  },
];
const typedRound: RoundData = {
  id: "r1",
  revision: 0,
  scores: [
    {
      userId: "a",
      blitzPileRemaining: null,
      totalCardsPlayed: null,
      typedScore: 14,
    },
    {
      guestId: "g",
      blitzPileRemaining: null,
      totalCardsPlayed: null,
      typedScore: -4,
    },
  ],
};

function TotalCard({ onUpdate }: { onUpdate: jest.Mock }) {
  const [entry, setEntry] = useState<PlayerEntry>({
    blitzRemaining: null,
    cardsPlayed: null,
    total: null,
  });
  return (
    <ScoreEntryCard
      name="Ann"
      color="#000"
      score={0}
      entry={entry}
      status={getEntryStatus(entry, "total")}
      mode="total"
      onUpdate={(field, value) => {
        onUpdate(field, value);
        setEntry((current) => ({ ...current, [field]: value }));
      }}
    />
  );
}

describe("Do math mode (typed round totals)", () => {
  beforeEach(() => {
    mockCapture.mockReset();
    jest.mocked(createRoundForGame).mockReset();
  });

  it("submits typed totals without a breakdown and tags the entry mode", async () => {
    jest
      .mocked(createRoundForGame)
      .mockResolvedValue({ ok: true, round: typedRound } as never);
    const { result } = renderHook(() =>
      useScoringDraft(
        "game-1",
        () => newRoundDraft(players, 1, "total"),
        jest.fn(),
      ),
    );
    act(() => {
      result.current.update("a", "total", 14);
      result.current.update("g", "total", -4);
    });
    await act(() => result.current.submit());

    expect(createRoundForGame).toHaveBeenCalledWith("game-1", 1, [
      { userId: "a", typedScore: 14 },
      { guestId: "g", typedScore: -4 },
    ]);
    expect(mockCapture).toHaveBeenCalledWith(
      "scoring_round_submitted",
      expect.objectContaining({ entry_mode: "total" }),
    );
  });

  it("reopens a typed round as totals and fills totals when a breakdown round switches", () => {
    const { result } = renderHook(() =>
      useScoringDraft("game-1", () => null, jest.fn()),
    );
    act(() => result.current.edit(players, typedRound, 1));
    expect(result.current.draft?.mode).toBe("total");
    expect(result.current.draft?.entries.g).toEqual({
      blitzRemaining: null,
      cardsPlayed: null,
      total: -4,
    });

    act(() => result.current.cancel());
    act(() =>
      result.current.edit(
        players,
        {
          id: "r2",
          revision: 0,
          scores: [
            { userId: "a", blitzPileRemaining: 0, totalCardsPlayed: 12 },
            { guestId: "g", blitzPileRemaining: 4, totalCardsPlayed: 6 },
          ],
        },
        2,
      ),
    );
    expect(result.current.draft?.mode).toBe("cards");
    act(() => result.current.setMode("total"));
    expect(result.current.draft?.entries.g.total).toBe(-2);
  });

  it("enters negative totals with the minus toggle and clamps to the round limits", () => {
    const onUpdate = jest.fn();
    render(<TotalCard onUpdate={onUpdate} />);
    const input = screen.getByLabelText("Ann Round score");

    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Ann score is negative" }),
    );
    expect(onUpdate).toHaveBeenLastCalledWith("total", -7);
    expect(input).toHaveValue("7");

    fireEvent.change(input, { target: { value: "99" } });
    expect(onUpdate).toHaveBeenLastCalledWith("total", -20);

    fireEvent.click(
      screen.getByRole("button", { name: "Ann score is negative" }),
    );
    fireEvent.change(input, { target: { value: "99" } });
    expect(onUpdate).toHaveBeenLastCalledWith("total", 40);

    fireEvent.change(input, { target: { value: "-3" } });
    expect(onUpdate).toHaveBeenLastCalledWith("total", -3);
  });

  it("switches modes from the toggle", () => {
    const onChange = jest.fn<void, [EntryMode]>();
    render(<EntryModeToggle mode="cards" onChange={onChange} />);
    expect(
      screen.getByRole("button", { name: "Cards + Blitz" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Round totals" }));
    expect(onChange).toHaveBeenCalledWith("total");
  });

  it("shows typed rounds honestly in the math view and graph series", () => {
    render(
      <RoundHistoryTable
        players={[
          { ...players[0], score: 14 },
          { ...players[1], score: -4 },
        ]}
        rounds={[typedRound]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show the math" }));
    expect(screen.getAllByText("total entered")).toHaveLength(2);

    const series = buildRoundGraphSeries(players, [typedRound]);
    expect(series.deltasByRound).toEqual({ a: [14], g: [-4] });
    expect(series.blitzByRound).toEqual({ a: [null], g: [null] });
    expect(series.scoredByRound).toEqual({ a: [true], g: [true] });
    expect(series.roundSamplesByPlayer).toEqual({ a: [], g: [] });
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoringShell } from "../../scoring/ScoringShell";
import { type RoundData } from "../../scoring/types";

const mockRouter = { refresh: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockCreate = jest.fn();
const mockEdit = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: jest.fn() }),
}));
jest.mock("@/server/mutations/rounds", () => ({
  createRoundForGame: (...args: unknown[]) => mockCreate(...args),
  updateRoundScores: (...args: unknown[]) => mockEdit(...args),
}));
jest.mock("@/server/mutations/games", () => ({ cloneGame: jest.fn() }));
jest.mock("../../scoring/RaceTrack", () => ({ RaceTrack: () => null }));
jest.mock("../../scoring/Standings", () => ({ Standings: () => null }));
jest.mock("../../scoring/GraphCarousel", () => ({ GraphCarousel: () => null }));
jest.mock("../../scoring/graphs/ScoreProgressionCard", () => ({
  ScoreProgressionCard: () => null,
}));
jest.mock("../../scoring/graphs/HotColdCard", () => ({
  HotColdCard: () => null,
}));
jest.mock("../../scoring/graphs/WinProbabilityCard", () => ({
  WinProbabilityCard: () => null,
}));
jest.mock("../../scoring/CelebrationOverlay", () => ({
  CelebrationOverlay: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Dismiss celebration</button>
  ),
}));

const players = [
  {
    id: "alice",
    userId: "alice",
    name: "Alice",
    color: "#ff0000",
    isGuest: false,
    score: 30,
  },
  {
    id: "bob",
    guestId: "bob",
    name: "Bob",
    color: "#0000ff",
    isGuest: true,
    score: 10,
  },
];
const firstRound: RoundData = {
  id: "r1",
  revision: 0,
  scores: [
    { userId: "alice", blitzPileRemaining: 0, totalCardsPlayed: 30 },
    { guestId: "bob", blitzPileRemaining: 5, totalCardsPlayed: 20 },
  ],
};
const props = {
  gameId: "game",
  players,
  rounds: [firstRound],
  currentRoundNumber: 2,
  winThreshold: 75,
  isFinished: false,
  sharedScoring: true,
};
const emptyProps = {
  ...props,
  rounds: [],
  currentRoundNumber: 1,
  players: players.map((player) => ({ ...player, score: 0 })),
};
function fillScores() {
  for (const [name, value] of [
    ["Alice Blitz left", "0"],
    ["Alice Cards played", "30"],
    ["Bob Blitz left", "5"],
    ["Bob Cards played", "20"],
  ]) {
    fireEvent.change(screen.getByRole("textbox", { name }), {
      target: { value },
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockImplementation(async (_game, number, scores) => ({
    ok: true,
    round: { id: `r${number}`, revision: 0, scores },
  }));
  mockEdit.mockImplementation(async (_game, id, scores, revision) => ({
    ok: true,
    round: { id, revision: revision + 1, scores },
  }));
});
afterEach(() => jest.useRealTimers());

it("labels every entry input and updates the remaining player count", () => {
  render(<ScoringShell {...emptyProps} />);
  expect(
    screen.getByRole("button", { name: "Submit Round (2 remaining)" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Alice Blitz left" }), {
    target: { value: "0" },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
    { target: { value: "30" } },
  );
  expect(
    screen.getByRole("button", { name: "Submit Round (1 remaining)" }),
  ).toBeDisabled();
  for (const input of screen.getAllByRole("textbox"))
    expect(input).toHaveAccessibleName();
});

it("submits once and blocks next-round entry until the saved snapshot arrives", async () => {
  let finish!: (value: unknown) => void;
  mockCreate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(<ScoringShell {...emptyProps} />);
  fillScores();
  const submit = screen.getByRole("button", { name: "Submit Round" });
  act(() => {
    fireEvent.click(submit);
    fireEvent.click(submit);
  });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toHaveValue("30");
  await act(async () => {
    finish({ ok: true, round: firstRound });
  });
  expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Enter Round 2 Scores" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit round 1" })).toBeDisabled();
  rerender(<ScoringShell {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Enter Round 2 Scores" }));
  expect(screen.getByText("Round 2")).toBeInTheDocument();
  fillScores();
  fireEvent.click(screen.getByRole("button", { name: "Submit Round" }));
  expect(mockCreate.mock.calls[1][1]).toBe(2);
});

it("retains the entire draft on request failure and lets the user retry", async () => {
  mockCreate.mockRejectedValueOnce(new Error("Connection interrupted"));
  render(<ScoringShell {...emptyProps} />);
  fillScores();
  fireEvent.click(screen.getByRole("button", { name: "Submit Round" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection interrupted",
  );
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toHaveValue("30");
  fireEvent.click(screen.getByRole("button", { name: "Submit Round" }));
  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));
  expect(mockCreate.mock.calls[1]).toEqual(mockCreate.mock.calls[0]);
});

it("requires explicit reconciliation before a conflicting create becomes an edit", async () => {
  mockCreate.mockResolvedValueOnce({
    ok: false,
    reason: "round_conflict",
    message: "Round already recorded",
  });
  const { rerender } = render(<ScoringShell {...emptyProps} />);
  fillScores();
  fireEvent.click(screen.getByRole("button", { name: "Submit Round" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: /Submit Round/ })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh current scores" }),
  );
  expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  expect(mockEdit).not.toHaveBeenCalled();
  const latest = {
    ...firstRound,
    revision: 3,
    scores: firstRound.scores.map((score) => ({
      ...score,
      totalCardsPlayed: 25,
    })),
  };
  rerender(<ScoringShell {...props} rounds={[latest]} />);
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toHaveValue("30");
  expect(
    screen.getByRole("table", { name: "Round 1: cards played / blitz left" }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Edit saved round using my draft" }),
  );
  expect(mockEdit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() =>
    expect(mockEdit).toHaveBeenCalledWith("game", "r1", firstRound.scores, 3),
  );
});

it("keeps the captured revision after refresh and another tap on the open round", async () => {
  mockEdit.mockResolvedValueOnce({
    ok: false,
    reason: "round_conflict",
    message: "Review latest scores",
  });
  const { rerender } = render(<ScoringShell {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit round 1" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
    { target: { value: "35" } },
  );
  rerender(
    <ScoringShell {...props} rounds={[{ ...firstRound, revision: 1 }]} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit round 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await screen.findByRole("alert");
  expect(mockEdit.mock.calls[0][3]).toBe(0);
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toHaveValue("35");
});

it("prevents editor selection, cancellation and repeated saves while a write is pending", async () => {
  let finish!: (value: unknown) => void;
  mockEdit.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <ScoringShell
      {...props}
      rounds={[firstRound, { ...firstRound, id: "r2" }]}
      currentRoundNumber={3}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit round 1" }));
  const save = screen.getByRole("button", { name: "Save Changes" });
  act(() => {
    fireEvent.click(save);
    fireEvent.click(save);
  });
  expect(mockEdit).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit round 2" })).toBeDisabled();
  await act(async () => {
    finish({ ok: true, round: { ...firstRound, revision: 1 } });
  });
});

it("pauses polling for an open draft and preserves it when another device finishes", () => {
  jest.useFakeTimers();
  const { rerender } = render(<ScoringShell {...props} />);
  act(() => jest.advanceTimersByTime(5_000));
  expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Edit round 1" }));
  fireEvent.change(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
    { target: { value: "35" } },
  );
  act(() => jest.advanceTimersByTime(10_000));
  expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
  const endedAt = new Date().toISOString();
  rerender(
    <ScoringShell {...props} isFinished winnerId="alice" endedAt={endedAt} />,
  );
  expect(
    screen.getByRole("textbox", { name: "Alice Cards played" }),
  ).toHaveValue("35");
  expect(
    screen.queryByRole("button", { name: "Dismiss celebration" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss celebration" }));
  rerender(
    <ScoringShell {...props} isFinished winnerId="alice" endedAt={endedAt} />,
  );
  expect(
    screen.queryByRole("button", { name: "Dismiss celebration" }),
  ).not.toBeInTheDocument();
  rerender(<ScoringShell {...props} />);
  rerender(
    <ScoringShell
      {...props}
      isFinished
      winnerId="bob"
      endedAt={new Date(Date.now() + 1_000).toISOString()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Dismiss celebration" }),
  ).toBeInTheDocument();
});

it("does not replay celebrations for old completed games", () => {
  render(
    <ScoringShell
      {...props}
      isFinished
      winnerId="alice"
      endedAt={new Date(Date.now() - 60_000).toISOString()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Dismiss celebration" }),
  ).not.toBeInTheDocument();
});

it("opens and cancels a round using the keyboard and restores focus", async () => {
  const user = userEvent.setup();
  render(<ScoringShell {...props} />);
  await user.tab();
  expect(screen.getByRole("region", { name: "Round scores" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Edit round 1" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("textbox", { name: "Alice Blitz left" }),
  ).toHaveFocus();
  for (let index = 0; index < 4; index++) await user.tab();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Edit round 1" })).toHaveFocus();
});

it("keeps eight long player names in readable, scrollable history columns", () => {
  const roster = Array.from({ length: 8 }, (_, index) => ({
    ...players[0],
    id: `p${index}`,
    userId: `p${index}`,
    name: `Player with a long name ${index}`,
  }));
  render(<ScoringShell {...props} players={roster} />);
  expect(screen.getAllByRole("columnheader")).toHaveLength(9);
  expect(screen.getByRole("table")).toHaveStyle({ minWidth: "864px" });
  expect(screen.getByRole("region", { name: "Round scores" })).toHaveAttribute(
    "tabindex",
    "0",
  );
});

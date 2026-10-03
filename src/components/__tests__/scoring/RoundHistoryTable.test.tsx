import { fireEvent, render, screen, within } from "@testing-library/react";
import { RoundHistoryTable } from "../../scoring/RoundHistoryTable";
import { type PlayerWithScore } from "../../scoring/types";

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
    id: "g1",
    name: "Guest Bob",
    color: "#0000ff",
    isGuest: true,
    guestId: "g1",
    score: 10,
  },
];

const rounds = [
  {
    id: "r1",
    revision: 0,
    scores: [
      { userId: "p1", blitzPileRemaining: 0, totalCardsPlayed: 30 },
      { guestId: "g1", blitzPileRemaining: 5, totalCardsPlayed: 20 },
    ],
  },
];

describe("RoundHistoryTable show the math", () => {
  beforeEach(() => window.localStorage.clear());

  it("hides the card breakdown until the toggle is pressed", () => {
    render(<RoundHistoryTable players={players} rounds={rounds} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("+30")).toBeInTheDocument();
    expect(within(table).getByText("+10")).toBeInTheDocument();
    expect(within(table).queryByText(/played/)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Show the math" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);

    expect(within(table).getByText("30 played")).toBeInTheDocument();
    expect(within(table).getByText("20 played − 5×2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide the math" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("remembers the preference on this device", () => {
    const { unmount } = render(
      <RoundHistoryTable players={players} rounds={rounds} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show the math" }));
    unmount();

    render(<RoundHistoryTable players={players} rounds={rounds} />);
    expect(screen.getByText("20 played − 5×2")).toBeInTheDocument();
  });

  it("still toggles when storage is unavailable", () => {
    const getItem = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    render(<RoundHistoryTable players={players} rounds={rounds} />);
    const toggle = screen.getByRole("button", { name: /the math/ });
    const wasShowing = toggle.getAttribute("aria-pressed") === "true";
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", String(!wasShowing));
    expect(screen.queryByText("30 played") !== null).toBe(!wasShowing);
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("keeps the toggle working when storage reads but rejects writes", () => {
    window.localStorage.setItem("blitzer:round-history-show-math", "false");
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    render(<RoundHistoryTable players={players} rounds={rounds} />);
    const toggle = screen.getByRole("button", { name: /the math/ });
    const wasShowing = toggle.getAttribute("aria-pressed") === "true";
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", String(!wasShowing));
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", String(wasShowing));
    setItem.mockRestore();
  });
});

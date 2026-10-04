import { render, screen } from "@testing-library/react";
import {
  CircleRecordBook,
  recordDetail,
  recordValue,
} from "../CircleRecords";
import type { CircleRecord } from "@/server/queries/circleRecords";

const at = new Date("2026-03-14T12:00:00Z");
const record = (overrides: Partial<CircleRecord>): CircleRecord => ({
  kind: "highestRound",
  value: 31,
  gameId: "game-1",
  playerName: "Priya",
  roundNumber: 4,
  at,
  ...overrides,
});

describe("record wording", () => {
  it.each([
    [record({}), "31", "Priya in round 4"],
    [record({ kind: "lowestRound", value: -20, playerName: "Dad", roundNumber: 2 }), "−20", "Dad in round 2"],
    [record({ kind: "mostBlitzes", value: 1, roundNumber: null }), "1", "Priya emptied their Blitz pile 1 time"],
    [record({ kind: "biggestComeback", value: 38, playerName: "Jo", roundNumber: null }), "38 pts", "Jo won from 38 points behind"],
    [record({ kind: "longestGame", value: 14, playerName: null, roundNumber: null }), "14 rounds", "Most rounds in a finished game"],
    [record({ kind: "fastestWin", value: 1, playerName: "Sam", roundNumber: null }), "1 round", "Sam reached the target"],
  ])("describes %o", (r, value, detail) => {
    expect(recordValue(r)).toBe(value);
    expect(recordDetail(r)).toBe(detail);
  });
});

describe("CircleRecordBook", () => {
  it("renders nothing without records", () => {
    const { container } = render(<CircleRecordBook records={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("links each record to the game that set it", () => {
    render(
      <CircleRecordBook
        records={[
          record({}),
          record({ kind: "longestGame", value: 14, gameId: "game-2", playerName: null, roundNumber: null }),
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Record book" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Highest round/ })).toHaveAttribute("href", "/games/game-1");
    expect(screen.getByRole("link", { name: /Longest game/ })).toHaveAttribute("href", "/games/game-2");
    expect(screen.getAllByText("Mar 14, 2026")).toHaveLength(2);
  });
});

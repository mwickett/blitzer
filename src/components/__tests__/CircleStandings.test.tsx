import { render, screen } from "@testing-library/react";
import {
  CircleHeadToHeadList,
  CircleStandingsTable,
} from "@/components/CircleStandings";
import type { CircleStandingRow } from "@/server/queries/circleStandings";

const standing = (
  overrides: Partial<CircleStandingRow> & Pick<CircleStandingRow, "playerId" | "displayName">,
): CircleStandingRow => ({
  playerKind: "user",
  avatarUrl: null,
  gamesPlayed: 2,
  winCount: 1,
  lossCount: 1,
  decidedGames: 2,
  winRate: 50,
  totalRounds: 4,
  totalBlitzes: 1,
  battingAverage: "0.250",
  cumulativeScore: 12,
  ...overrides,
});

describe("CircleStandingsTable", () => {
  it("renders empty state with a new-game link", () => {
    render(<CircleStandingsTable standings={[]} />);
    expect(screen.getByText(/No Circle games yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /New Circle game/i }),
    ).toHaveAttribute("href", "/games/new?type=circle");
  });

  it("renders ranked rows and guest badges", () => {
    render(
      <CircleStandingsTable
        standings={[
          standing({
            playerId: "u1",
            displayName: "alice",
            winRate: 100,
            winCount: 2,
            lossCount: 0,
            decidedGames: 2,
          }),
          standing({
            playerId: "g1",
            displayName: "Patio Guest",
            playerKind: "guest",
          }),
        ]}
      />,
    );

    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Patio Guest")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getAllByText("0.250")).toHaveLength(2);
  });
});

describe("CircleHeadToHeadList", () => {
  it("renders nothing when there are no pairs", () => {
    const { container } = render(<CircleHeadToHeadList pairs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists rivalry records", () => {
    render(
      <CircleHeadToHeadList
        pairs={[
          {
            playerAId: "a",
            playerAName: "alice",
            playerBId: "b",
            playerBName: "bob",
            gamesPlayed: 3,
            aWins: 2,
            bWins: 1,
          },
        ]}
      />,
    );
    expect(screen.getByText("Head-to-head")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    expect(screen.getByText("2–1")).toBeInTheDocument();
  });
});

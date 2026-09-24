import { render, screen } from "@testing-library/react";
import { WinProbabilityDemo } from "@/components/marketing/WinProbabilityDemo";
import { useRaceForecast } from "@/components/scoring/graphs/useRaceForecast";
import { calcRaceForecast } from "@/lib/scoring/probability";

jest.mock("@/components/scoring/graphs/useRaceForecast", () => ({
  useRaceForecast: jest.fn(),
}));

beforeEach(() => {
  (useRaceForecast as jest.Mock).mockImplementation((input) => ({
    containerRef: { current: null },
    forecast: calcRaceForecast(
      input.players,
      input.winThreshold,
      input.deltasByPlayer,
      input.options,
    ),
    status: input.players[0].roundsPlayed < 3 ? "insufficient" : "ready",
  }));
});

describe("WinProbabilityDemo", () => {
  it("renders real odds rather than the not-enough-rounds fallback", () => {
    render(<WinProbabilityDemo />);

    expect(screen.getByText("Win Probability")).toBeInTheDocument();
    expect(
      screen.queryByText("Available after 3 rounds")
    ).not.toBeInTheDocument();
  });

  it("shows every demo player", () => {
    render(<WinProbabilityDemo />);

    // getAllByText, not getByText: the card prints each name twice — once on
    // its probability bar and again as a Race Outlook stat detail
    // ("Next-round danger: Dana"). getByText throws on multiple matches.
    for (const name of ["Dana", "Mike", "Priya", "Tom"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });
});

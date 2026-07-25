import { render, screen } from "@testing-library/react";
import { WinProbabilityDemo } from "@/components/marketing/WinProbabilityDemo";

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

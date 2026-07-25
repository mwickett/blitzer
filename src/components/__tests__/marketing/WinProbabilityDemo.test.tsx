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

    for (const name of ["Dana", "Mike", "Priya", "Tom"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});

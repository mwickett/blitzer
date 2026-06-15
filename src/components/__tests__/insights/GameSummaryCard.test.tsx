import { render, screen } from "@testing-library/react";
import { GameSummaryCard } from "@/components/insights/GameSummaryCard";

describe("GameSummaryCard", () => {
  it("renders the recap content when ready", () => {
    render(<GameSummaryCard status="ready" content="Mike edged Sarah." />);
    expect(screen.getByText("Mike edged Sarah.")).toBeInTheDocument();
  });

  it("shows a pending message while generating", () => {
    render(<GameSummaryCard status="pending" content={null} />);
    expect(screen.getByText(/being written/i)).toBeInTheDocument();
  });

  it("shows the insufficient-data message", () => {
    render(<GameSummaryCard status="insufficient_data" content={null} />);
    expect(screen.getByText(/not enough rounds/i)).toBeInTheDocument();
  });

  it("renders nothing on failure", () => {
    const { container } = render(
      <GameSummaryCard status="failed" content={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

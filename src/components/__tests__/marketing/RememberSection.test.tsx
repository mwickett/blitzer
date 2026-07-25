import { render, screen } from "@testing-library/react";
import { RememberSection } from "@/components/marketing/RememberSection";

describe("RememberSection", () => {
  it("claims shared history and shareable results", () => {
    render(<RememberSection />);

    expect(screen.getByText(/lands in your Circle/i)).toBeInTheDocument();
    expect(screen.getByText(/link anyone can open/i)).toBeInTheDocument();
  });

  it("makes no group-stats claim, because Circles have no stats surface", () => {
    const { container } = render(<RememberSection />);
    const copy = container.textContent ?? "";

    // stats.ts is entirely `…ForUser` — there is no circle leaderboard,
    // head-to-head record, or group standing anywhere in the product.
    for (const forbidden of [
      /leaderboard/i,
      /head.to.head/i,
      /group stats/i,
      /your group's stats/i,
      /stack up game after game/i,
      /best in your circle/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });
});

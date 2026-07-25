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
    //
    // This list is necessarily incomplete: an earlier headline read "Your
    // average — per round, per game, against one specific person?", which is a
    // head-to-head claim that matched none of these patterns and shipped past
    // a green test. Treat a passing run as a floor, not proof — any copy edit
    // to this section still needs a human to check the claim against
    // stats.ts.
    for (const forbidden of [
      /leaderboard/i,
      /head.to.head/i,
      /group stats/i,
      /your group's stats/i,
      /stack up game after game/i,
      /best in your circle/i,
      /against (one|a) specific/i,
      /per round, per game/i,
      /\bopponent\b/i,
      /\brivalry\b/i,
      /\bversus\b/i,
      /games won/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });
});

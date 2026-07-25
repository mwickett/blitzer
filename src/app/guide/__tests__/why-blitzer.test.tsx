import { render } from "@testing-library/react";
import WhyBlitzer from "@/app/guide/why-blitzer/page";

describe("Why Blitzer page", () => {
  it("makes none of the retired vision doc's unbuilt promises", () => {
    const { container } = render(<WhyBlitzer />);
    const copy = container.textContent ?? "";

    // The 2024 vision doc promised all of these. None of them ship:
    // friend approval was replaced by Circles (#205); there are no global
    // leaderboards; outlier showcases were never built; AI chat is Insights,
    // which is flag-gated and excluded from marketing entirely.
    for (const forbidden of [
      /friend request/i,
      /approve friendships/i,
      /best Dutch Blitz players in the world/i,
      /leaderboard/i,
      /AI chat/i,
      /ask questions of the data/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });

  it("tells the origin story in the present tense", () => {
    const { container } = render(<WhyBlitzer />);
    expect(container.textContent).toMatch(/in the moment/i);
  });
});

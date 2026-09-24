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
    //
    // Two earlier patterns here could never fire: /approve friendships/ does
    // not match "approving friendships", and /ask questions of the data/ was
    // narrower than any phrasing anyone would write. Both were decorative.
    // And a per-opponent claim shipped past this list once already, which is
    // why /against (one|a) specific/ is here. Treat a green run as a floor,
    // not proof — a copy edit still needs a human to check the claim.
    for (const forbidden of [
      /friend requests?/i,
      /approv\w*\s+(a\s+)?friend/i,
      /best Dutch Blitz players in the world/i,
      /leaderboard/i,
      /AI chat/i,
      /chat (with|to) (your|the) (data|stats)/i,
      /quer(y|ying) (your|the) (data|stats)/i,
      /ask (it |them )?(questions?|anything)/i,
      /against (one|a) specific/i,
      /these are all answerable/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });

  it("tells the origin story in the present tense", () => {
    const { container } = render(<WhyBlitzer />);
    expect(container.textContent).toMatch(/in the moment/i);
  });
});

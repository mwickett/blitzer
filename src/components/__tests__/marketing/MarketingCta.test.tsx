import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Must be named `mock*` — jest.mock factories are hoisted above imports and
// may only reference out-of-scope variables whose names begin with "mock".
const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

import { MarketingCta } from "@/components/marketing/MarketingCta";

describe("MarketingCta", () => {
  beforeEach(() => mockCapture.mockClear());

  it("renders a link to the destination", () => {
    render(
      <MarketingCta section="hero" href="/guide">
        See how it works
      </MarketingCta>
    );

    expect(
      screen.getByRole("link", { name: "See how it works" })
    ).toHaveAttribute("href", "/guide");
  });

  it("captures a snake_case event with the section and destination, and no PII", async () => {
    const user = userEvent.setup();
    render(
      <MarketingCta section="hero" href="/guide">
        See how it works
      </MarketingCta>
    );

    await user.click(screen.getByRole("link", { name: "See how it works" }));

    expect(mockCapture).toHaveBeenCalledWith("marketing_cta_clicked", {
      section: "hero",
      destination: "/guide",
    });
  });
});

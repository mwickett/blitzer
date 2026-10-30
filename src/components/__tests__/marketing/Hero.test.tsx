import { render, screen } from "@testing-library/react";
import { Hero } from "@/components/marketing/Hero";
import { GAME_RULES } from "@/lib/validation/gameRules";

jest.mock("posthog-js/react", () => ({ usePostHog: () => null }));

describe("Hero", () => {
  it("leads with the arithmetic Blitzer takes off the table", () => {
    render(<Hero />);
    expect(screen.getByText("Nobody has to do the math.")).toBeInTheDocument();
    expect(screen.getByText(/minus-twos/)).toBeInTheDocument();
  });

  it("states the player cap from the game rules", () => {
    render(<Hero />);
    expect(
      screen.getByText(`Up to ${GAME_RULES.MAX_PLAYERS} players`),
    ).toBeInTheDocument();
  });
});

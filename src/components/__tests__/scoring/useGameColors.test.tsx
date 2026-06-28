import { fireEvent, render, screen } from "@testing-library/react";
import {
  useGameColors,
  type ColorStepPlayer,
} from "../../scoring/useGameColors";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

function buildPlayers(count: number): ColorStepPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    isGuest: false,
    isCurrentUser: index === 0,
    defaultColor: null,
  }));
}

function GameColorsHarness({ players }: { players: ColorStepPlayer[] }) {
  const { colors, updateColor } = useGameColors(players);

  return (
    <div>
      {players.map((player) => (
        <output key={player.id} data-testid={player.id}>
          {colors[player.id]}
        </output>
      ))}
      <button
        type="button"
        onClick={() =>
          updateColor(players[players.length - 1].id, ACCENT_COLORS[0].value)
        }
      >
        Set last player blue
      </button>
    </div>
  );
}

describe("useGameColors", () => {
  it("cascades color conflicts while the palette can stay unique", () => {
    render(<GameColorsHarness players={buildPlayers(4)} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Set last player blue" })
    );

    expect(screen.getByTestId("p1")).not.toHaveTextContent(
      ACCENT_COLORS[0].value
    );
    expect(screen.getByTestId("p4")).toHaveTextContent(ACCENT_COLORS[0].value);
  });

  it("allows duplicate colors for eight-player expansion games", () => {
    render(<GameColorsHarness players={buildPlayers(8)} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Set last player blue" })
    );

    expect(screen.getByTestId("p1")).toHaveTextContent(ACCENT_COLORS[0].value);
    expect(screen.getByTestId("p8")).toHaveTextContent(ACCENT_COLORS[0].value);
  });
});

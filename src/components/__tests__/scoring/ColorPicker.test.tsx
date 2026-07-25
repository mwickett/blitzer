import { fireEvent, render, screen } from "@testing-library/react";
import { ColorPicker } from "../../scoring/ColorPicker";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

describe("ColorPicker", () => {
  it("disables colors used by other players by default", () => {
    render(
      <ColorPicker
        value={null}
        onChange={jest.fn()}
        usedColors={[ACCENT_COLORS[0].value]}
      />
    );

    expect(
      screen.getByRole("button", { name: "Blue (taken)" })
    ).toBeDisabled();
  });

  it("allows selecting an already-used color when duplicates are allowed", () => {
    const onChange = jest.fn();

    render(
      <ColorPicker
        value={null}
        onChange={onChange}
        usedColors={[ACCENT_COLORS[0].value]}
        allowDuplicateColors
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    expect(onChange).toHaveBeenCalledWith(ACCENT_COLORS[0].value);
  });
});

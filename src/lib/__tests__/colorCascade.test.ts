import { ACCENT_COLORS } from "../scoring/colors";
import { resolveColorCascade } from "../scoring/colorCascade";

const [blue, red, yellow, green, copper, rosewood] = ACCENT_COLORS;

describe("resolveColorCascade", () => {
  it("sets the chosen color for the target player", () => {
    const colors = { a: blue.value, b: red.value };
    const result = resolveColorCascade(colors, "a", green.value);
    expect(result.a).toBe(green.value);
    expect(result.b).toBe(red.value);
  });

  it("bumps displaced player to first unused ACCENT_COLOR", () => {
    const colors = { a: blue.value, b: red.value };
    // a takes red from b. After assignment: a=red, b=?
    // Used colors: red. Free from palette: blue (index 0).
    const result = resolveColorCascade(colors, "a", red.value);
    expect(result.a).toBe(red.value);
    expect(result.b).toBe(blue.value);
  });

  it("never produces duplicate colors when palette has room", () => {
    const colors = { a: blue.value, b: red.value, c: yellow.value };
    const result = resolveColorCascade(colors, "a", red.value);
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("handles no displacement when color is unoccupied", () => {
    const colors = { a: blue.value, b: red.value };
    const result = resolveColorCascade(colors, "a", yellow.value);
    expect(result).toEqual({ a: yellow.value, b: red.value });
  });

  it("handles displaced player getting first unused ACCENT_COLOR", () => {
    const colors = {
      a: blue.value,
      b: red.value,
      c: yellow.value,
    };
    // a takes red from b. After assignment: a=red, b=?, c=yellow.
    // Used colors in next state: {red, yellow}. Free from palette at index 0: blue.
    const result = resolveColorCascade(colors, "a", red.value);
    expect(result.a).toBe(red.value);
    expect(result.b).toBe(blue.value);
    expect(result.c).toBe(yellow.value);
  });

  it("falls back to freed color when palette is exhausted (7+ players)", () => {
    const colors = {
      a: blue.value,
      b: red.value,
      c: yellow.value,
      d: green.value,
      e: copper.value,
      f: rosewood.value,
      g: blue.value, // wrapped — already a duplicate
    };
    // a takes red from b — no free palette slot, b gets a's old color (blue)
    const result = resolveColorCascade(colors, "a", red.value);
    expect(result.a).toBe(red.value);
    expect(result.b).toBe(blue.value);
  });
});

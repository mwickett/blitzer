import { resolveColorCascade } from "../scoring/colorCascade";

describe("resolveColorCascade", () => {
  it("sets the chosen color for the target player", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    const result = resolveColorCascade(colors, "a", "#22c55e");
    expect(result.a).toBe("#22c55e");
    expect(result.b).toBe("#ef4444");
  });

  it("bumps displaced player to first unused ACCENT_COLOR", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    // a takes red from b. After assignment: a=#ef4444, b=?
    // Used colors: #ef4444. Free from palette: #3b82f6 (blue, index 0).
    const result = resolveColorCascade(colors, "a", "#ef4444");
    expect(result.a).toBe("#ef4444");
    expect(result.b).toBe("#3b82f6"); // blue — first unused in ACCENT_COLORS order
  });

  it("never produces duplicate colors when palette has room", () => {
    const colors = { a: "#3b82f6", b: "#ef4444", c: "#eab308" };
    const result = resolveColorCascade(colors, "a", "#ef4444");
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("handles no displacement when color is unoccupied", () => {
    const colors = { a: "#3b82f6", b: "#ef4444" };
    const result = resolveColorCascade(colors, "a", "#eab308");
    expect(result).toEqual({ a: "#eab308", b: "#ef4444" });
  });

  it("handles displaced player getting first unused ACCENT_COLOR", () => {
    const colors = {
      a: "#3b82f6", // blue
      b: "#ef4444", // red
      c: "#eab308", // yellow
    };
    // a takes red from b. After assignment: a=red, b=?, c=yellow.
    // Used colors in next state: {red, yellow}. Free from palette at index 0: blue (#3b82f6).
    const result = resolveColorCascade(colors, "a", "#ef4444");
    expect(result.a).toBe("#ef4444");
    expect(result.b).toBe("#3b82f6"); // blue — first free in ACCENT_COLORS order after a vacates it
    expect(result.c).toBe("#eab308"); // unchanged
  });

  it("falls back to freed color when palette is exhausted (7+ players)", () => {
    const colors = {
      a: "#3b82f6", // blue
      b: "#ef4444", // red
      c: "#eab308", // yellow
      d: "#22c55e", // green
      e: "#8b5cf6", // purple
      f: "#f97316", // orange
      g: "#3b82f6", // blue (wrapped — already a duplicate)
    };
    // a takes red from b — no free palette slot, b gets a's old color (blue)
    const result = resolveColorCascade(colors, "a", "#ef4444");
    expect(result.a).toBe("#ef4444");
    expect(result.b).toBe("#3b82f6"); // gets a's freed blue
  });
});

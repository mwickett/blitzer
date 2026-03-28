import {
  ACCENT_COLORS,
  resolvePlayerColor,
  assignColorsToPlayers,
} from "../scoring/colors";

describe("ACCENT_COLORS", () => {
  it("defines exactly 6 colors", () => {
    expect(ACCENT_COLORS).toHaveLength(6);
  });

  it("each color has a value and label", () => {
    for (const color of ACCENT_COLORS) {
      expect(color.value).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.label).toBeTruthy();
    }
  });
});

describe("resolvePlayerColor", () => {
  it("returns per-game override when present", () => {
    const result = resolvePlayerColor({
      gameColor: "#ef4444",
      userDefault: "#3b82f6",
    });
    expect(result).toBe("#ef4444");
  });

  it("falls back to user default when no game override", () => {
    const result = resolvePlayerColor({
      gameColor: null,
      userDefault: "#3b82f6",
    });
    expect(result).toBe("#3b82f6");
  });

  it("returns null when no color set anywhere", () => {
    const result = resolvePlayerColor({
      gameColor: null,
      userDefault: null,
    });
    expect(result).toBeNull();
  });
});

describe("assignColorsToPlayers", () => {
  it("assigns first available color to players without one", () => {
    const players = [
      { id: "1", resolvedColor: "#3b82f6" },
      { id: "2", resolvedColor: null },
      { id: "3", resolvedColor: null },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe("#3b82f6");
    expect(result["2"]).toBeTruthy();
    expect(result["3"]).toBeTruthy();
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("respects first-come priority for conflicts", () => {
    const players = [
      { id: "1", resolvedColor: "#3b82f6" },
      { id: "2", resolvedColor: "#3b82f6" },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe("#3b82f6");
    expect(result["2"]).not.toBe("#3b82f6");
  });
});

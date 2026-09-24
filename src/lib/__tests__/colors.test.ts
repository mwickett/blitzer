import {
  ACCENT_COLORS,
  ACCENT_CONTRAST_BG,
  contrastRatio,
  resolvePlayerColor,
  assignColorsToPlayers,
} from "../scoring/colors";

const [blue, red, yellow, green, copper, rosewood] = ACCENT_COLORS;

describe("ACCENT_COLORS", () => {
  it("defines exactly 6 colors", () => {
    expect(ACCENT_COLORS).toHaveLength(6);
  });

  it("each color has a lowercase hex value and label", () => {
    for (const color of ACCENT_COLORS) {
      expect(color.value).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.label).toBeTruthy();
    }
  });

  it("leads with the four Dutch Blitz face colours", () => {
    expect(ACCENT_COLORS.slice(0, 4).map((c) => c.label)).toEqual([
      "Blue",
      "Red",
      "Yellow",
      "Green",
    ]);
  });

  it("keeps two brand-warm extras beyond the deck colours", () => {
    expect([copper.label, rosewood.label]).toEqual(["Copper", "Rosewood"]);
  });

  it("meets WCAG AA contrast as score text on brand cream", () => {
    for (const color of ACCENT_COLORS) {
      expect(contrastRatio(color.value, ACCENT_CONTRAST_BG)).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  it("meets WCAG AA contrast for white RaceTrack pip numerals", () => {
    for (const color of ACCENT_COLORS) {
      expect(contrastRatio("#ffffff", color.value)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("resolvePlayerColor", () => {
  it("returns per-game override when present", () => {
    const result = resolvePlayerColor({
      gameColor: red.value,
      userDefault: blue.value,
    });
    expect(result).toBe(red.value);
  });

  it("falls back to user default when no game override", () => {
    const result = resolvePlayerColor({
      gameColor: null,
      userDefault: blue.value,
    });
    expect(result).toBe(blue.value);
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
      { id: "1", resolvedColor: blue.value },
      { id: "2", resolvedColor: null },
      { id: "3", resolvedColor: null },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe(blue.value);
    expect(result["2"]).toBe(red.value);
    expect(result["3"]).toBe(yellow.value);
    const values = Object.values(result);
    expect(new Set(values).size).toBe(values.length);
  });

  it("respects first-come priority for conflicts", () => {
    const players = [
      { id: "1", resolvedColor: blue.value },
      { id: "2", resolvedColor: blue.value },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe(blue.value);
    expect(result["2"]).not.toBe(blue.value);
    expect(result["2"]).toBe(red.value);
  });

  it("preserves historical hexes that are outside the current palette", () => {
    const legacyBlue = "#3b82f6";
    const players = [
      { id: "1", resolvedColor: legacyBlue },
      { id: "2", resolvedColor: null },
    ];
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe(legacyBlue);
    expect(result["2"]).toBe(blue.value);
  });

  it("wraps after the six-colour palette for 7+ players", () => {
    const players = Array.from({ length: 7 }, (_, i) => ({
      id: String(i + 1),
      resolvedColor: null,
    }));
    const result = assignColorsToPlayers(players);
    expect(result["1"]).toBe(blue.value);
    expect(result["4"]).toBe(green.value);
    expect(result["7"]).toBe(blue.value);
  });
});

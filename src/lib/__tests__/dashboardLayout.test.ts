import {
  DASHBOARD_CARDS,
  defaultDashboardLayout,
  isDefaultLayout,
  moveCard,
  normalizeDashboardLayout,
  setCardVisible,
  visibleCards,
} from "../dashboardLayout";

const allIds = DASHBOARD_CARDS.map((card) => card.id);

describe("dashboard layout", () => {
  it("defaults to every card in catalog order with opt-in cards hidden", () => {
    const layout = defaultDashboardLayout();
    expect(layout.order).toEqual(allIds);
    expect(layout.hidden).toEqual(["averages"]);
    expect(isDefaultLayout(layout)).toBe(true);
  });

  it.each([null, undefined, "nope", 7, {}, { order: "record" }])(
    "falls back to defaults for %p",
    (value) => {
      expect(normalizeDashboardLayout(value)).toEqual(defaultDashboardLayout());
    },
  );

  it("drops unknown and duplicate ids and appends cards added since the save", () => {
    const layout = normalizeDashboardLayout({
      order: ["rivals", "retired", "rivals", "record"],
      hidden: ["record", "retired", "not-in-order"],
    });
    expect(layout.order.slice(0, 2)).toEqual(["rivals", "record"]);
    expect(new Set(layout.order)).toEqual(new Set(allIds));
    expect(layout.order).toHaveLength(allIds.length);
    // Saved choice kept, new default-hidden card stays hidden.
    expect(layout.hidden).toEqual(["record", "averages"]);
  });

  it("keeps a default-hidden card visible once the user has shown it", () => {
    const layout = normalizeDashboardLayout({ order: allIds, hidden: [] });
    expect(visibleCards(layout)).toContain("averages");
  });

  it("moves cards among visible cards, skipping hidden ones", () => {
    const base = normalizeDashboardLayout({
      order: ["record", "averages", "form"],
      hidden: ["averages"],
    });
    const moved = moveCard(base, "form", -1);
    expect(visibleCards(moved).slice(0, 2)).toEqual(["form", "record"]);
    expect(moveCard(moved, "form", -1)).toBe(moved);
    expect(isDefaultLayout(moved)).toBe(false);
  });

  it("hides cards and re-shows them at the end", () => {
    const hidden = setCardVisible(defaultDashboardLayout(), "record", false);
    expect(visibleCards(hidden)).not.toContain("record");
    const shown = setCardVisible(hidden, "record", true);
    expect(visibleCards(shown).at(-1)).toBe("record");
    expect(shown.hidden).toEqual(["averages"]);
  });
});

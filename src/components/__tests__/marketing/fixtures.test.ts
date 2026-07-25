import {
  DEMO_PLAYERS,
  DEMO_WIN_THRESHOLD,
  DEMO_ROUNDS_PLAYED,
  DEMO_DELTAS_BY_PLAYER,
  DEMO_SCORES_BY_ROUND,
} from "@/components/marketing/fixtures";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

describe("marketing fixtures", () => {
  it("gives every player a colour from the real accent palette", () => {
    const palette = ACCENT_COLORS.map((c) => c.value);
    for (const player of DEMO_PLAYERS) {
      expect(palette).toContain(player.color);
    }
  });

  it("has enough rounds for the win-probability forecast to render", () => {
    // WinProbabilityCard falls back to "Available after 3 rounds" below this.
    expect(DEMO_ROUNDS_PLAYED).toBeGreaterThanOrEqual(3);
  });

  it("keeps deltas, cumulative scores, and standings in agreement", () => {
    for (const player of DEMO_PLAYERS) {
      const deltas = DEMO_DELTAS_BY_PLAYER[player.id];
      const cumulative = DEMO_SCORES_BY_ROUND[player.id];

      expect(deltas).toHaveLength(DEMO_ROUNDS_PLAYED);
      expect(cumulative).toHaveLength(DEMO_ROUNDS_PLAYED);

      const runningTotals = deltas.reduce<number[]>((acc, delta) => {
        acc.push((acc[acc.length - 1] ?? 0) + delta);
        return acc;
      }, []);

      expect(runningTotals).toEqual(cumulative);
      expect(player.score).toBe(cumulative[cumulative.length - 1]);
    }
  });

  it("keeps every player short of the win threshold so the game reads as live", () => {
    for (const player of DEMO_PLAYERS) {
      expect(player.score).toBeLessThan(DEMO_WIN_THRESHOLD);
    }
  });

  it("includes a guest player, since the Gather section claims guests are supported", () => {
    const guests = DEMO_PLAYERS.filter((p) => p.isGuest);
    expect(guests).toHaveLength(1);
    expect(guests[0].guestId).toBeDefined();
  });
});

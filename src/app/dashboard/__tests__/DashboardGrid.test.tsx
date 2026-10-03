import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardGrid from "../_components/DashboardGrid";
import { saveDashboardLayout } from "@/server/mutations/dashboard";
import { defaultDashboardLayout } from "@/lib/dashboardLayout";
import { EMPTY_GAME_STATS, EMPTY_ROUND_STATS } from "@/server/queries/playerStats";
import type { DashboardStats } from "@/server/queries/stats";

jest.mock("@/server/mutations/dashboard", () => ({
  saveDashboardLayout: jest.fn(),
}));
jest.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return new Proxy({}, { get: () => Stub });
});

const stats: DashboardStats = {
  battingAverage: { totalHandsPlayed: 20, totalHandsWon: 5, battingAverage: "0.250" },
  scoreExtremes: {
    highest: { score: 31, totalCardsPlayed: 31, blitzPileRemaining: 0 },
    lowest: { score: -12, totalCardsPlayed: 4, blitzPileRemaining: 8 },
  },
  cumulativeScore: 412,
  gameRoundExtremes: {
    longest: { id: "long", roundCount: 11 },
    shortest: { id: "short", roundCount: 3 },
  },
  games: { ...EMPTY_GAME_STATS, gamesCount: 4, completedGames: 4, winCount: 3, lossCount: 1, decidedGames: 4, winRate: 75 },
  rounds: { ...EMPTY_ROUND_STATS, totalRounds: 20, totalBlitzes: 5, totalCardsPlayed: 300, avgCardsPlayed: 15, avgBlitzRemaining: 2.5 },
  recentGames: [
    { id: "g4", finishedAt: "2026-10-03T00:00:00.000Z", won: true, score: 80, place: 1, playerCount: 3, roundCount: 5 },
    { id: "g3", finishedAt: "2026-10-02T00:00:00.000Z", won: true, score: 77, place: 1, playerCount: 3, roundCount: 6 },
    { id: "g2", finishedAt: "2026-10-01T00:00:00.000Z", won: true, score: 76, place: 1, playerCount: 2, roundCount: 4 },
    { id: "g1", finishedAt: "2026-09-30T00:00:00.000Z", won: false, score: 41, place: 3, playerCount: 3, roundCount: 7 },
  ],
  streaks: { current: { kind: "win", length: 3 }, bestWin: 3 },
  rivals: [
    { playerId: "u2", kind: "user", name: "Dad", avatarUrl: null, gamesTogether: 4, myWins: 3, theirWins: 1 },
  ],
};

const cardTitles = () =>
  screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"));

describe("DashboardGrid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (saveDashboardLayout as jest.Mock).mockImplementation(async (layout) => ({
      ok: true,
      layout: layout ?? defaultDashboardLayout(),
    }));
  });

  it("shows the default cards with their stats", () => {
    render(<DashboardGrid stats={stats} initialLayout={defaultDashboardLayout()} />);

    expect(cardTitles()).toEqual([
      "Win rate", "Recent form", "Batting average", "Recent scores", "Rivals",
      "Best and worst hand", "Career totals", "Game length",
    ]);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 wins, 1 loss")).toBeInTheDocument();
    expect(screen.getByText("On fire: 3 wins in a row")).toBeInTheDocument();
    expect(screen.getByText("Dad")).toBeInTheDocument();
    expect(screen.getByText("4 games together · You lead")).toBeInTheDocument();
    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hide/i })).not.toBeInTheDocument();
  });

  it("hides, reorders, and restores cards, saving each change", async () => {
    const user = userEvent.setup();
    render(<DashboardGrid stats={stats} initialLayout={defaultDashboardLayout()} />);

    await user.click(screen.getByRole("button", { name: "Customize" }));
    await user.click(screen.getByRole("button", { name: "Hide Win rate" }));
    expect(cardTitles()[0]).toBe("Recent form");

    await user.click(screen.getByRole("button", { name: "Move Rivals earlier" }));
    expect(cardTitles().slice(2, 4)).toEqual(["Rivals", "Recent scores"]);

    await user.click(screen.getByRole("button", { name: "Show Per-round averages" }));
    expect(cardTitles().at(-1)).toBe("Per-round averages");
    expect(screen.getByText("15")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(saveDashboardLayout).toHaveBeenCalledTimes(3);
    const lastSaved = (saveDashboardLayout as jest.Mock).mock.calls.at(-1)[0];
    expect(lastSaved.hidden).toEqual(["record"]);

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(saveDashboardLayout).toHaveBeenLastCalledWith(null);
    expect(cardTitles()[0]).toBe("Win rate");
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: /hide/i })).not.toBeInTheDocument();
  });

  it("tells the user when a save fails", async () => {
    (saveDashboardLayout as jest.Mock).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<DashboardGrid stats={stats} initialLayout={defaultDashboardLayout()} />);

    await user.click(screen.getByRole("button", { name: "Customize" }));
    await user.click(screen.getByRole("button", { name: "Hide Rivals" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Couldn't save your layout"),
    );
    expect(cardTitles()).not.toContain("Rivals");
  });

  it("renders friendly empty states for a new player", () => {
    const empty: DashboardStats = {
      battingAverage: { totalHandsPlayed: 0, totalHandsWon: 0, battingAverage: "0.000" },
      scoreExtremes: { highest: null, lowest: null },
      cumulativeScore: 0,
      gameRoundExtremes: { longest: null, shortest: null },
      games: { ...EMPTY_GAME_STATS },
      rounds: { ...EMPTY_ROUND_STATS },
      recentGames: [],
      streaks: { current: null, bestWin: 0 },
      rivals: [],
    };
    render(<DashboardGrid stats={empty} initialLayout={defaultDashboardLayout()} />);

    const winRate = screen.getByRole("region", { name: "Win rate" });
    expect(within(winRate).getByText("Finish a game to see this.")).toBeInTheDocument();
    expect(screen.getByText(/start a rivalry/)).toBeInTheDocument();
  });
});

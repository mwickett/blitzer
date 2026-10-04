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
  rounds: { ...EMPTY_ROUND_STATS, totalRounds: 20, breakdownRounds: 20, totalBlitzes: 5, totalCardsPlayed: 300, avgCardsPlayed: 15, avgBlitzRemaining: 2.5 },
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
  moments: [
    { key: "comeback", emoji: "🎢", title: "Biggest comeback", headline: "Down 31, still won", detail: "Oct 2, 2026", gameId: "g3" },
    { key: "nemesis", emoji: "😈", title: "Your nemesis", headline: "Grandma", detail: "You 1, Grandma 3 across 4 games" },
  ],
  decks: [
    { deck: "pump", games: 5, wins: 2, winRate: 40 },
    { deck: "carriage", games: 3, wins: 3, winRate: 100 },
    { deck: "bucket", games: 1, wins: 1, winRate: 100 },
  ],
  widest: {
    games: [
      { gameId: "g5", finishedAt: "2026-10-02T15:00:00Z", spread: 42.5, leaderName: "me", leaderIsMe: true },
      { gameId: "g6", finishedAt: "2026-09-28T15:00:00Z", spread: 30, leaderName: "Dad", leaderIsMe: false },
    ],
    round: { gameId: "g6", finishedAt: "2026-09-28T15:00:00Z", spread: 21.3, leaderName: "Dad", leaderIsMe: false, roundNumber: 4 },
  },
  momentHistory: {
    leadChanges: {
      gamesAnalyzed: 5, gamesWithLeadChanges: 2, totalLeadChanges: 7, leadsTaken: 4, leadsLost: 2,
      winsFromBehind: 1, mostLeadChanges: { gameId: "g7", finishedAt: "2026-09-27T15:00:00Z", count: 5 },
    },
    mine: { tornado: 1, u_turn: 0, short_fuse: 2, shortcoming: 0, bounce_back: 3 },
    tornadoesSuffered: 1,
    feed: [
      { key: "g7:tornado", gameId: "g7", finishedAt: "2026-09-27T15:00:00Z", icon: "🌪️", title: "Tornado", detail: "You climbed from dead last after round 2 to the win, while Dad, leading then, finished last.", starring: true },
    ],
  },
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
      "Win rate", "Recent form", "Batting average", "Recent scores", "Best and worst hand",
      "Rivals", "Career totals", "Memorable moments", "Lucky deck", "Widest games", "Named moments", "Lead changes", "Game length",
    ]);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 wins, 1 loss")).toBeInTheDocument();
    expect(screen.getByText("On fire: 3 wins in a row")).toBeInTheDocument();
    expect(screen.getByText("Dad")).toBeInTheDocument();
    expect(screen.getByText("4 games together · You lead")).toBeInTheDocument();
    expect(screen.getByText("412")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Biggest comeback.*Down 31, still won/ })).toHaveAttribute("href", "/games/g3");
    expect(screen.getByText("Grandma")).toBeInTheDocument();
    // The lucky deck needs enough games: the one-game bucket doesn't qualify.
    const decks = screen.getByRole("region", { name: "Lucky deck" });
    expect(within(decks).getByText("100% wins with this deck")).toBeInTheDocument();
    expect(within(decks).getAllByText("Carriage")).toHaveLength(2);
    expect(within(decks).getByText("40% of 5 games")).toBeInTheDocument();
    const widest = screen.getByRole("region", { name: "Widest games" });
    expect(within(widest).getByText("+42.5")).toBeInTheDocument();
    expect(within(widest).getByRole("link", { name: /You finished this far ahead/ })).toHaveAttribute("href", "/games/g5");
    expect(within(widest).getByRole("link", { name: /Dad led/ })).toHaveAttribute("href", "/games/g6");
    expect(within(widest).getByRole("link", { name: /Widest round: Dad in round 4/ })).toBeInTheDocument();
    expect(within(widest).getByText("+21.3")).toBeInTheDocument();
    const named = screen.getByRole("region", { name: "Named moments" });
    expect(within(named).getByRole("link", { name: /Tornado.*You climbed from dead last/ })).toHaveAttribute("href", "/games/g7");
    expect(within(named).getByText("Bounce backs").nextSibling).toHaveTextContent("3");
    expect(within(named).getByText(/Caught in 1 tornado/)).toBeInTheDocument();
    const lead = screen.getByRole("region", { name: "Lead changes" });
    expect(within(lead).getByText("40%")).toBeInTheDocument();
    expect(within(lead).getByText("1.4")).toBeInTheDocument();
    expect(within(lead).getByRole("link", { name: /Wildest game/ })).toHaveAttribute("href", "/games/g7");
    expect(within(lead).getByText("5 changes")).toBeInTheDocument();
    // Results are not conveyed by bar colour alone.
    expect(
      screen.getByRole("img", { name: /^Final scores, oldest to newest: 41 \(loss\), 76 \(win\)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hide/i })).not.toBeInTheDocument();
  });

  it("hides, reorders, and restores cards, saving each change", async () => {
    const user = userEvent.setup();
    render(<DashboardGrid stats={stats} initialLayout={defaultDashboardLayout()} />);

    await user.click(screen.getByRole("button", { name: "Customize" }));
    await user.click(screen.getByRole("button", { name: "Hide Win rate" }));
    expect(cardTitles()[0]).toBe("Recent form");

    await user.click(screen.getByRole("button", { name: "Move Rivals earlier" }));
    expect(cardTitles().slice(3, 5)).toEqual(["Rivals", "Best and worst hand"]);

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
      moments: [],
      decks: [],
      widest: { games: [], round: null },
      momentHistory: {
        leadChanges: {
          gamesAnalyzed: 0, gamesWithLeadChanges: 0, totalLeadChanges: 0, leadsTaken: 0, leadsLost: 0,
          winsFromBehind: 0, mostLeadChanges: null,
        },
        mine: { tornado: 0, u_turn: 0, short_fuse: 0, shortcoming: 0, bounce_back: 0 },
        tornadoesSuffered: 0,
        feed: [],
      },
    };
    render(<DashboardGrid stats={empty} initialLayout={defaultDashboardLayout()} />);

    const winRate = screen.getByRole("region", { name: "Win rate" });
    expect(within(winRate).getByText("Finish a game to see this.")).toBeInTheDocument();
    expect(screen.getByText(/start a rivalry/)).toBeInTheDocument();
    expect(screen.getByText(/stories will start showing up/)).toBeInTheDocument();
    expect(screen.getByText(/Tag your deck when you set up a game/)).toBeInTheDocument();
    expect(screen.getByText(/No tornadoes or U-turns yet/)).toBeInTheDocument();
    const lead = screen.getByRole("region", { name: "Lead changes" });
    expect(within(lead).getByText("Finish a game to see this.")).toBeInTheDocument();
  });
});

describe("DashboardGrid saving", () => {
  it("sends one save at a time and only the latest layout after it", async () => {
    const resolvers: Array<() => void> = [];
    (saveDashboardLayout as jest.Mock).mockImplementation(
      (layout) =>
        new Promise((resolve) => {
          resolvers.push(() => resolve({ ok: true, layout: layout ?? defaultDashboardLayout() }));
        }),
    );
    const user = userEvent.setup();
    render(<DashboardGrid stats={stats} initialLayout={defaultDashboardLayout()} />);

    await user.click(screen.getByRole("button", { name: "Customize" }));
    await user.click(screen.getByRole("button", { name: "Hide Win rate" }));
    await user.click(screen.getByRole("button", { name: "Hide Rivals" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    // The first save is still in flight, so nothing else has been sent.
    expect(saveDashboardLayout).toHaveBeenCalledTimes(1);
    resolvers.shift()!();
    await waitFor(() => expect(saveDashboardLayout).toHaveBeenCalledTimes(2));
    // The two queued changes collapse into the final one: the reset.
    expect(saveDashboardLayout).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    resolvers.shift()!();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(saveDashboardLayout).toHaveBeenCalledTimes(2);
  });
});

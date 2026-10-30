import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import BadgesPage from "../page";
import { BADGE_FAMILIES, BADGES } from "@/lib/scoring/badges";

const mockRequireSignedIn = jest.fn();
const mockGetMyBadges = jest.fn();
jest.mock("@/server/pageAuth", () => ({ requireSignedIn: () => mockRequireSignedIn() }));
jest.mock("@/server/queries/badges", () => ({
  BADGE_GAMES_WINDOW: 300,
  getMyBadges: () => mockGetMyBadges(),
}));

const progress = BADGES.map((badge) => ({
  badge,
  count: badge.id === "snipe" ? 3 : badge.id === "wins_10" ? 1 : 0,
  firstGameId: badge.id === "snipe" ? "g4" : badge.id === "wins_10" ? "g9" : null,
  firstAt: badge.id === "snipe" ? "2026-10-04T18:00:00Z" : badge.id === "wins_10" ? "2026-10-20T18:00:00Z" : null,
}));

async function renderPage(element: Promise<ReactNode>) {
  return render(<>{await element}</>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSignedIn.mockResolvedValue({ userId: "user_1" });
  mockGetMyBadges.mockResolvedValue(progress);
});

describe("Badges page", () => {
  it("lists every badge by family with how to earn it", async () => {
    await renderPage(BadgesPage());
    expect(mockRequireSignedIn).toHaveBeenCalled();
    expect(screen.getByText(new RegExp(`2 of ${BADGES.length} earned`))).toBeInTheDocument();
    for (const family of BADGE_FAMILIES) {
      expect(screen.getByRole("heading", { level: 2, name: family.name })).toBeInTheDocument();
    }
    for (const badge of BADGES) {
      const entry = document.getElementById(`badge-${badge.id}`)!;
      expect(within(entry).getByRole("heading", { name: badge.name })).toBeInTheDocument();
      expect(within(entry).getByText(badge.rule)).toBeInTheDocument();
    }
  });

  it("shows earned counts with a link to the first game, and locked badges as not earned", async () => {
    await renderPage(BadgesPage());
    const snipe = document.getElementById("badge-snipe")!;
    expect(within(snipe).getByText(/Earned 3 times · first on Oct 4, 2026/)).toBeInTheDocument();
    expect(within(snipe).getByRole("link", { name: "See the game" })).toHaveAttribute("href", "/games/g4");
    // Milestones are earned once, whatever the count.
    expect(within(document.getElementById("badge-wins_10")!).getByText(/^Earned · first on Oct 20, 2026/)).toBeInTheDocument();
    const tornado = document.getElementById("badge-tornado")!;
    expect(within(tornado).getByText("Not earned yet")).toBeInTheDocument();
    expect(within(tornado).queryByRole("link")).not.toBeInTheDocument();
  });
});

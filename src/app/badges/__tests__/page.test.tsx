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

const locked = (badge: (typeof BADGES)[number], total: number | null = null) => ({
  badge, count: 0, firstGameId: null, firstAt: null, tiers: [], total,
});
const progress = BADGES.map((badge) => {
  switch (badge.id) {
    case "snipe":
      return { ...locked(badge), count: 3, firstGameId: "g4", firstAt: "2026-10-04T18:00:00Z" };
    case "winner":
      return {
        ...locked(badge, 23),
        count: 2,
        firstGameId: "g1",
        firstAt: "2026-09-01T18:00:00Z",
        tiers: [
          { gameId: "g1", at: "2026-09-01T18:00:00Z" },
          { gameId: "g9", at: "2026-10-20T18:00:00Z" },
        ],
      };
    case "regular":
    case "blitzer":
      return locked(badge, 4);
    default:
      return locked(badge);
  }
});

async function renderPage(element: Promise<ReactNode>) {
  return render(<>{await element}</>);
}

const entry = (id: string) => document.getElementById(`badge-${id}`)!;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSignedIn.mockResolvedValue({ userId: "user_1" });
  mockGetMyBadges.mockResolvedValue(progress);
});

describe("Badges page", () => {
  it("lists every badge by family with how to earn it", async () => {
    await renderPage(BadgesPage());
    expect(mockRequireSignedIn).toHaveBeenCalled();
    expect(BADGES).toHaveLength(12);
    expect(screen.getByText(new RegExp(`2 of ${BADGES.length} earned`))).toBeInTheDocument();
    for (const family of BADGE_FAMILIES) {
      expect(screen.getByRole("heading", { level: 2, name: family.name })).toBeInTheDocument();
    }
    for (const badge of BADGES) {
      expect(within(entry(badge.id)).getByRole("heading", { name: badge.name })).toBeInTheDocument();
      expect(within(entry(badge.id)).getByText(badge.rule)).toBeInTheDocument();
    }
  });

  it("shows earned counts with a link to the first game, and locked badges as not earned", async () => {
    await renderPage(BadgesPage());
    expect(within(entry("snipe")).getByText(/Earned 3 times/)).toHaveTextContent(
      "Earned 3 times · First earned on Oct 4, 2026 · See the game",
    );
    expect(within(entry("snipe")).getByRole("link", { name: "See the game" })).toHaveAttribute("href", "/games/g4");
    expect(within(entry("photo_finish")).getByText("Not earned yet")).toBeInTheDocument();
    expect(within(entry("photo_finish")).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows milestone tiers and how far the next one is", async () => {
    await renderPage(BadgesPage());
    const winner = entry("winner");
    expect(within(winner).getByText(/Silver reached on Oct 20, 2026/)).toHaveTextContent(
      "Silver reached on Oct 20, 2026 · See the game · 23 of 50 wins for gold",
    );
    expect(within(winner).getByRole("link", { name: "See the game" })).toHaveAttribute("href", "/games/g9");
    expect(within(entry("regular")).getByText("4 of 10 games for bronze")).toBeInTheDocument();
  });
});

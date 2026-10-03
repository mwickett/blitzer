import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import Dashboard from "../page";

const mockRequireSignedIn = jest.fn();
const mockGetDashboard = jest.fn();
jest.mock("@/server/pageAuth", () => ({ requireSignedIn: () => mockRequireSignedIn() }));
jest.mock("@/server/queries/stats", () => ({ getDashboard: () => mockGetDashboard() }));
// An async server component; covered by its own test
jest.mock("../_components/CircleCtaSection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../_components/DashboardGrid", () => ({
  __esModule: true,
  default: ({ intro, heading, initialLayout }: { intro: ReactNode; heading: ReactNode; initialLayout: unknown }) => (
    <div data-testid="grid" data-layout={JSON.stringify(initialLayout)}>
      {heading}
      {intro}
    </div>
  ),
}));

const layout = { cards: ["record"] };
const dashboard = (gamesCount: number) => ({ stats: { games: { gamesCount } }, layout });

async function renderPage(element: Promise<ReactNode>) {
  return render(<>{await element}</>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSignedIn.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
  mockGetDashboard.mockResolvedValue(dashboard(4));
});

describe("Dashboard page", () => {
  it("links Circle members to their standings and passes the saved layout", async () => {
    await renderPage(Dashboard());
    expect(screen.getByRole("link", { name: "View Circle standings" })).toHaveAttribute("href", "/circles");
    expect(screen.getByTestId("grid")).toHaveAttribute("data-layout", JSON.stringify(layout));
    expect(screen.queryByText("Your stats start with your first game.")).not.toBeInTheDocument();
  });

  it("omits the standings link for pickup-only players", async () => {
    mockRequireSignedIn.mockResolvedValue({ userId: "user_1", orgId: null });
    await renderPage(Dashboard());
    expect(screen.getByText("Your stats")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Circle standings" })).not.toBeInTheDocument();
  });

  it("prompts a new player to start their first game", async () => {
    mockGetDashboard.mockResolvedValue(dashboard(0));
    await renderPage(Dashboard());
    expect(screen.getByText("Your stats start with your first game.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a game" })).toHaveAttribute("href", "/games/new");
  });

  it("does not load stats for a signed-out visitor", async () => {
    mockRequireSignedIn.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(Dashboard()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockGetDashboard).not.toHaveBeenCalled();
  });
});

/** @jest-environment node */
// Replaces the old middleware route matcher: each protected page must check
// sign-in (and a Circle where needed) itself, before it loads any data.
jest.mock("server-only", () => ({}));

const mockRequireSignedIn = jest.fn();
const mockRequireCircle = jest.fn();
jest.mock("@/server/pageAuth", () => ({
  requireSignedIn: () => mockRequireSignedIn(),
  requireCircle: () => mockRequireCircle(),
}));

const mockDataLoad = jest.fn();
jest.mock("@/server/db/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/server/queries/games", () => ({ getGames: mockDataLoad, getLegacyGames: mockDataLoad }));
jest.mock("@/server/queries/circleStandings", () => ({ getCircleStandings: mockDataLoad }));
jest.mock("@/server/queries/circleRecords", () => ({ getCircleRecords: mockDataLoad }));
jest.mock("@/server/queries/stats", () => ({ getDashboard: mockDataLoad }));
jest.mock("@/server/queries/lobbies", () => ({ getPickupLobbyForParticipant: mockDataLoad }));
jest.mock("@/server/queries/playerHighlights", () => ({ getPlayerHighlightsForClerkUser: mockDataLoad }));
jest.mock("@/server/clerkOrgs", () => ({ getOrgMemberClerkIds: mockDataLoad }));
jest.mock("@/featureFlags", () => ({ isLlmFeaturesEnabled: mockDataLoad }));

const GAME_ID = "0b6c0d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const props = {
  searchParams: Promise.resolve({ type: "circle" }),
  params: Promise.resolve({ id: GAME_ID }),
};

type Page = (pageProps: typeof props) => Promise<unknown>;
const pages: Record<string, () => Promise<{ default: Page }>> = {
  "/dashboard": () => import("../dashboard/page"),
  "/games": () => import("../games/page"),
  "/games/new": () => import("../games/new/page"),
  "/games/[id]/lobby": () => import("../games/[id]/lobby/page"),
  "/circles/setup": () => import("../circles/setup/page"),
  "/games/legacy": () => import("../games/legacy/page"),
  "/circles": () => import("../circles/page"),
  "/insights": () => import("../insights/page"),
};

const signedOut = new Error("signed out");

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSignedIn.mockRejectedValue(signedOut);
  mockRequireCircle.mockRejectedValue(signedOut);
});

it.each([
  ["/dashboard", mockRequireSignedIn],
  ["/games", mockRequireSignedIn],
  ["/games/new", mockRequireSignedIn],
  ["/games/[id]/lobby", mockRequireSignedIn],
  ["/circles/setup", mockRequireSignedIn],
  ["/games/legacy", mockRequireCircle],
  ["/circles", mockRequireCircle],
  ["/insights", mockRequireCircle],
])("%s checks access before loading data", async (path, guard) => {
  const { default: page } = await pages[path]();
  await expect(page(props)).rejects.toBe(signedOut);
  expect(guard).toHaveBeenCalledTimes(1);
  expect(mockDataLoad).not.toHaveBeenCalled();
});

it("pickup players without a Circle keep their games, stats, and the pickup flow", async () => {
  // Pages that need only sign-in never ask for a Circle
  for (const path of ["/dashboard", "/games", "/games/new", "/games/[id]/lobby", "/circles/setup"]) {
    const { default: page } = await pages[path]();
    await page(props).catch(() => {});
  }
  expect(mockRequireCircle).not.toHaveBeenCalled();
});

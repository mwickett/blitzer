/** @jest-environment node */
import { POST } from "./route";

const mockAuth = jest.fn();
const mockEnabled = jest.fn();
const mockGame = jest.fn();
const mockHistory = jest.fn();
const mockRecap = jest.fn();
const mockCapture = jest.fn();
const mockStandings = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("@/featureFlags", () => ({ isLlmFeaturesEnabled: () => mockEnabled() }));
jest.mock("@/server/queries/games", () => ({ getGameById: (id: string) => mockGame(id) }));
jest.mock("@/server/queries/rosterHistory", () => ({ getRosterHistory: (...args: unknown[]) => mockHistory(...args) }));
jest.mock("@/server/ai/roundRecap", () => ({ writeRoundRecap: (...args: unknown[]) => mockRecap(...args) }));
jest.mock("@/server/telemetry", () => ({ captureServerEvent: (...args: unknown[]) => mockCapture(...args) }));
jest.mock("@ai-sdk/openai", () => ({ openai: () => ({}) }));
jest.mock("@posthog/ai", () => ({ withTracing: (model: unknown) => model }));
jest.mock("@/lib/gameLogic", () => ({ __esModule: true, default: (game: unknown) => mockStandings(game) }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({}) }));

const circleGame = (overrides: Record<string, unknown> = {}) => ({
  id: "game-1", kind: "CIRCLE", organizationId: "circle", startedAt: new Date(), isFinished: false,
  players: [{ userId: "u1", guestId: null, user: { clerk_user_id: "clerk-1" } }, { userId: null, guestId: "g1", user: null }],
  rounds: [{ round: 1, scores: [] }],
  ...overrides,
});
const call = () => POST(new Request("https://example.invalid/api/games/game-1/recap", { method: "POST" }), {
  params: Promise.resolve({ gameId: "game-1" }),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-only";
  mockAuth.mockResolvedValue({ userId: "clerk-1", orgId: "circle" });
  mockEnabled.mockResolvedValue(true);
  mockGame.mockResolvedValue(circleGame());
  mockHistory.mockResolvedValue({ gamesTogether: 0, winsByPlayer: {}, lastWinnerId: null });
  mockRecap.mockResolvedValue("Mike leads!");
  mockStandings.mockReturnValue([{ isWinner: false }, { isWinner: false }]);
});

it("returns a recap for people at the table, using this group's history", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ text: "Mike leads!" });
  expect(mockHistory).toHaveBeenCalledWith("game-1", ["u1", "g1"]);
});

it("requires sign-in and the llm-features flag", async () => {
  mockAuth.mockResolvedValueOnce({ userId: null });
  expect((await call()).status).toBe(401);
  mockEnabled.mockResolvedValueOnce(false);
  expect((await call()).status).toBe(403);
  expect(mockGame).not.toHaveBeenCalled();
});

it("hides games the caller cannot score", async () => {
  mockAuth.mockResolvedValue({ userId: "clerk-9", orgId: "other-circle" });
  expect((await call()).status).toBe(404);
  mockGame.mockResolvedValue(null);
  expect((await call()).status).toBe(404);
  expect(mockRecap).not.toHaveBeenCalled();
});

it("only recaps between rounds", async () => {
  mockStandings.mockReturnValueOnce([{ isWinner: true }, { isWinner: false }]);
  expect((await call()).status).toBe(409);
  mockGame.mockResolvedValue(circleGame({ rounds: [] }));
  expect((await call()).status).toBe(409);
});

it("decides completion from the scores, like the game page", async () => {
  mockGame.mockResolvedValue(circleGame({ isFinished: true }));
  expect((await call()).status).toBe(200);
});

it("reports model failures without leaking details", async () => {
  mockRecap.mockRejectedValue(new TypeError("boom"));
  const response = await call();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("boom");
  expect(mockCapture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    event: "llm_error",
    properties: { feature: "round_recap", error_type: "TypeError" },
  }));
});

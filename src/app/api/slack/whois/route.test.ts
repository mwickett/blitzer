/** @jest-environment node */
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockUser = { findFirst: jest.fn(), findUnique: jest.fn() };
const mockGame = { count: jest.fn(), findFirst: jest.fn() };
jest.mock("@/server/db/db", () => ({ __esModule: true, default: {
  user: { findFirst: (...args: unknown[]) => mockUser.findFirst(...args), findUnique: (...args: unknown[]) => mockUser.findUnique(...args) },
  game: { count: (...args: unknown[]) => mockGame.count(...args), findFirst: (...args: unknown[]) => mockGame.findFirst(...args) },
} }));
jest.mock("@/server/queries/stats", () => ({
  getPlayerBattingAverageForUser: async () => ({ totalHandsPlayed: 10, totalHandsWon: 4, battingAverage: "0.400" }),
  getCumulativeScoreForUser: async () => 125,
}));

const now = 1_800_000_000;
function signedRequest(timestamp = String(now), fields: Record<string, string> = {}, signature?: string) {
  const body = new URLSearchParams({ team_id: "T_ALLOWED", user_id: "U_ALLOWED", text: "test-user", ...fields }).toString();
  const signed = `v0=${createHmac("sha256", "fixture_secret").update(`v0:${timestamp}:${body}`).digest("hex")}`;
  return new NextRequest("https://example.invalid/api/slack/whois", {
    method: "POST", body,
    headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": signature ?? signed },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(now * 1000);
  process.env.SLACK_SIGNING_SECRET = "fixture_secret";
  process.env.SLACK_WHOIS_TEAM_ID = "T_ALLOWED";
  process.env.SLACK_WHOIS_USER_IDS = "U_ALLOWED, U_SECOND";
  mockUser.findFirst.mockResolvedValue({ id: "user-id" });
  mockUser.findUnique.mockResolvedValue({ username: "test-user", createdAt: new Date(0) });
  mockGame.count.mockResolvedValue(3);
  mockGame.findFirst.mockResolvedValue({ startedAt: new Date(0) });
});
afterEach(() => jest.restoreAllMocks());

test("valid authorized requests return private reports without email", async () => {
  const response = await POST(signedRequest());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.response_type).toBe("ephemeral");
  expect(JSON.stringify(body)).toContain("0.400");
  expect(JSON.stringify(body)).not.toContain("Email");
  expect(mockUser.findUnique).toHaveBeenCalledWith({ where: { id: "user-id" }, select: { username: true, createdAt: true } });
  expect(mockGame.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ startedAt: { not: null } }) }));
});

test.each([String(now - 301), String(now + 301), "1", "NaN", "1e9", "-1", "123.5"])("rejects signed invalid/stale timestamp %s before querying accounts", async (timestamp) => {
  expect((await POST(signedRequest(timestamp))).status).toBe(401);
  expect(mockUser.findFirst).not.toHaveBeenCalled();
});

test.each([String(now - 300), String(now + 300)])("accepts the five-minute boundary %s", async (timestamp) => {
  expect((await POST(signedRequest(timestamp))).status).toBe(200);
});

test.each(["v0=wrong", `v0=${"x".repeat(64)}`, `v0=${"0".repeat(64)}`])("rejects a bad signature", async (signature) => {
  expect((await POST(signedRequest(String(now), {}, signature))).status).toBe(401);
  expect(mockUser.findFirst).not.toHaveBeenCalled();
});

const unauthorizedRequests: Record<string, string>[] = [{ team_id: "T_OTHER" }, { user_id: "U_OTHER" }, { user_id: "" }];
test.each(unauthorizedRequests)("rejects authentic requests outside the configured audience", async (fields) => {
  expect((await POST(signedRequest(String(now), fields))).status).toBe(403);
  expect(mockUser.findFirst).not.toHaveBeenCalled();
});

test.each(["SLACK_WHOIS_TEAM_ID", "SLACK_WHOIS_USER_IDS"])("missing %s denies access", async (key) => {
  delete process.env[key];
  expect((await POST(signedRequest())).status).toBe(403);
  expect(mockUser.findFirst).not.toHaveBeenCalled();
});

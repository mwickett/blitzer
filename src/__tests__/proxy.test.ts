/** @jest-environment node */
import { NextRequest } from "next/server";

import proxy from "../proxy";

// Expose the route handler itself; createRouteMatcher stays real
jest.mock("@clerk/nextjs/server", () => ({
  ...jest.requireActual("@clerk/nextjs/server"),
  clerkMiddleware: (handler: unknown) => handler,
}));

type Handler = (auth: unknown, req: NextRequest) => Promise<Response | void>;
const handler = proxy as unknown as Handler;

const GAME_ID = "0b6c0d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

async function visit(path: string, session: { userId?: string; orgId?: string }) {
  const protect = jest.fn();
  const auth = Object.assign(jest.fn(async () => session), { protect });
  const response = await handler(auth, new NextRequest(`https://blitzer.test${path}`));
  return {
    protect,
    redirect: response ? new URL(response.headers.get("location")!).pathname : null,
  };
}

const member = { userId: "user_1", orgId: "org_1" };
const noCircle = { userId: "user_1" };

describe("proxy route protection", () => {
  it.each(["/dashboard", "/insights", "/games", "/games/new", "/circles", "/api/chat"])(
    "requires sign-in for %s",
    async (path) => {
      expect((await visit(path, member)).protect).toHaveBeenCalled();
    },
  );

  it.each(["/", "/guide", "/privacy", `/games/${GAME_ID}`])(
    "leaves %s public",
    async (path) => {
      const { protect, redirect } = await visit(path, {});
      expect(protect).not.toHaveBeenCalled();
      expect(redirect).toBeNull();
    },
  );

  it("protects pickup lobbies but not the spectator view of the same game", async () => {
    expect((await visit(`/games/${GAME_ID}/lobby`, noCircle)).protect).toHaveBeenCalled();
    expect((await visit(`/games/${GAME_ID}`, noCircle)).protect).not.toHaveBeenCalled();
  });
});

describe("proxy Circle setup redirect", () => {
  it.each(["/insights", "/circles", "/games/legacy"])(
    "sends a signed-in player without a Circle from %s to setup",
    async (path) => {
      expect((await visit(path, noCircle)).redirect).toBe("/circles/setup");
    },
  );

  it.each([
    "/dashboard",
    "/games",
    "/games/new",
    "/circles/setup",
    "/circles/invite-friends",
    `/games/${GAME_ID}/lobby`,
    `/games/${GAME_ID}`,
    "/guide",
  ])("lets a player without a Circle use %s", async (path) => {
    expect((await visit(path, noCircle)).redirect).toBeNull();
  });

  it("never redirects Circle members or signed-out visitors", async () => {
    expect((await visit("/insights", member)).redirect).toBeNull();
    expect((await visit("/insights", {})).redirect).toBeNull();
  });
});

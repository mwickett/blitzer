import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getPickupLobbyForParticipant } from "@/server/queries/lobbies";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";
import PickupLobbyPage from "../page";

const mockControls = jest.fn();
const mockQr = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));
jest.mock("next/headers", () => ({ headers: jest.fn() }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/server/queries/lobbies", () => ({
  getPickupLobbyForParticipant: jest.fn(),
}));
jest.mock("../LobbyControls", () => ({
  LobbyControls: (props: Record<string, unknown>) => {
    mockControls(props);
    return null;
  },
}));
jest.mock("../LobbyQrCode", () => ({
  LobbyQrCode: (props: Record<string, unknown>) => {
    mockQr(props);
    return null;
  },
}));

const ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "NODE_ENV",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const env = process.env as Record<string, string | undefined>;

const host = {
  id: "player-host",
  userId: "host",
  guestId: null,
  user: { id: "host", username: "Hosty", clerk_user_id: "clerk-host", avatarUrl: null },
  guestUser: null,
};
const guest = {
  id: "player-guest",
  userId: null,
  guestId: "guest-1",
  user: null,
  guestUser: { id: "guest-1", name: "Gran" },
};
const lobby = (overrides: Record<string, unknown> = {}) => ({
  id: "lobby-1",
  kind: "PICKUP",
  startedAt: null,
  joinToken: "token-1",
  joinCode: "ABC123",
  hostUserId: "host",
  createdAt: new Date(),
  players: [host, guest],
  ...overrides,
});

async function renderPage() {
  render(await PickupLobbyPage({ params: Promise.resolve({ id: "lobby-1" }) }));
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of ENV_KEYS) delete env[key];
  env.NODE_ENV = "test";
  (auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk-host" });
  (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(lobby());
});

afterAll(() => {
  for (const key of ENV_KEYS) env[key] = savedEnv[key];
});

const joinUrl = () => mockQr.mock.calls[0][0].joinUrl;

describe("join link host", () => {
  it("prefers the configured app URL", async () => {
    env.NEXT_PUBLIC_APP_URL = "blitzer.example/some/path";
    env.VERCEL_URL = "blitzer-abc123.vercel.app";
    await renderPage();
    expect(joinUrl()).toBe("https://blitzer.example/join/token-1");
  });

  it("uses the production domain, not the per-deployment host, in production", async () => {
    env.VERCEL_ENV = "production";
    env.VERCEL_PROJECT_PRODUCTION_URL = "www.blitzer.fun";
    env.VERCEL_URL = "blitzer-abc123.vercel.app";
    await renderPage();
    expect(joinUrl()).toBe("https://www.blitzer.fun/join/token-1");
  });

  it("uses the deployment host on previews", async () => {
    env.VERCEL_ENV = "preview";
    env.VERCEL_URL = "blitzer-abc123.vercel.app";
    await renderPage();
    expect(joinUrl()).toBe("https://blitzer-abc123.vercel.app/join/token-1");
  });

  it("uses the request host only for localhost in development", async () => {
    env.NODE_ENV = "development";
    (headers as jest.Mock).mockResolvedValue(new Headers({ host: "localhost:3000" }));
    await renderPage();
    expect(joinUrl()).toBe("http://localhost:3000/join/token-1");
  });

  it("ignores a spoofed request host and falls back to the canonical domain", async () => {
    env.NODE_ENV = "development";
    (headers as jest.Mock).mockResolvedValue(new Headers({ host: "evil.example" }));
    await renderPage();
    expect(joinUrl()).toBe("https://www.blitzer.fun/join/token-1");
  });
});

describe("lobby access", () => {
  it("sends non-participants and missing lobbies back to the games list", async () => {
    (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("REDIRECT /games");
  });

  it.each([
    ["started", { startedAt: new Date() }],
    ["tokenless", { joinToken: null }],
  ])("sends a %s game to its scoring page", async (_label, overrides) => {
    (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(lobby(overrides));
    await expect(renderPage()).rejects.toThrow("REDIRECT /games/lobby-1");
    expect(redirect).toHaveBeenCalledWith("/games/lobby-1");
  });
});

describe("lobby view", () => {
  it("lists the table with host and guest badges and gives the host the start control", async () => {
    await renderPage();

    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(
      screen.getByText(`At the table (2 of ${MAX_PICKUP_PLAYERS})`),
    ).toBeInTheDocument();
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(mockControls).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: "lobby-1", isHost: true, canStart: true }),
    );
  });

  it("does not give other players host controls", async () => {
    (auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk-other" });
    await renderPage();
    expect(mockControls).toHaveBeenCalledWith(expect.objectContaining({ isHost: false }));
  });

  it("waits for a second player before allowing a start", async () => {
    (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(lobby({ players: [host] }));
    await renderPage();
    expect(mockControls).toHaveBeenCalledWith(expect.objectContaining({ canStart: false }));
  });

  it("says when the table is full", async () => {
    const players = Array.from({ length: MAX_PICKUP_PLAYERS }, (_, index) => ({
      ...guest,
      id: `player-${index}`,
      guestId: `guest-${index}`,
    }));
    (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(lobby({ players }));
    await renderPage();
    expect(screen.getByText(/The table is full/)).toBeInTheDocument();
  });

  it("explains an expired lobby instead of the full-table note", async () => {
    (getPickupLobbyForParticipant as jest.Mock).mockResolvedValue(
      lobby({ createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000) }),
    );
    await renderPage();
    expect(screen.getByText(/This lobby has expired/)).toBeInTheDocument();
  });
});

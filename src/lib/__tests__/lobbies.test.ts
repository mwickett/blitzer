import { LOBBY_MAX_AGE_MS, isLobbyExpired, isLobbyOpen } from "../lobbies";

describe("lobby rules", () => {
  const now = new Date("2026-07-25T12:00:00Z");
  const openLobby = {
    kind: "PICKUP",
    startedAt: null,
    isFinished: false,
    createdAt: new Date(now.getTime() - 60_000),
  };

  it("keeps a fresh, unstarted pickup lobby open", () => {
    expect(isLobbyOpen(openLobby, now)).toBe(true);
  });

  it("closes a lobby once the host starts play", () => {
    expect(isLobbyOpen({ ...openLobby, startedAt: now }, now)).toBe(false);
  });

  it("closes a lobby that has aged past the maximum", () => {
    const stale = {
      ...openLobby,
      createdAt: new Date(now.getTime() - LOBBY_MAX_AGE_MS - 1),
    };
    expect(isLobbyExpired(stale.createdAt, now)).toBe(true);
    expect(isLobbyOpen(stale, now)).toBe(false);
  });

  it("holds a lobby open right up to the boundary", () => {
    const edge = new Date(now.getTime() - LOBBY_MAX_AGE_MS);
    expect(isLobbyExpired(edge, now)).toBe(false);
  });

  it("never treats a Circle game as a lobby", () => {
    expect(isLobbyOpen({ ...openLobby, kind: "CIRCLE" }, now)).toBe(false);
  });
});

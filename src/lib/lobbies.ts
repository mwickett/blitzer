/**
 * Rules an open pickup lobby is held to. These live in `lib` because both the
 * server actions that enforce them and the pages that explain them to players
 * need the same numbers.
 */

/**
 * Dutch Blitz expansion packs seat up to eight, so that is the ceiling. Past
 * six the accent palette repeats (see `assignColorsToPlayers`) — that is
 * accepted for large games rather than a reason to cap lower.
 */
export const MAX_PICKUP_PLAYERS = 8;

/**
 * A pickup lobby is a same-sitting thing. Its join token and code stay live
 * until the host starts, so without an expiry a QR screenshot forwarded weeks
 * later would still add players to a game nobody is at.
 */
export const LOBBY_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isLobbyExpired(createdAt: Date, now: Date = new Date()) {
  return now.getTime() - createdAt.getTime() > LOBBY_MAX_AGE_MS;
}

/** True when a lobby can still accept the roster it has room for. */
export function isLobbyOpen(
  lobby: {
    kind: string;
    startedAt: Date | null;
    isFinished: boolean;
    createdAt: Date;
  },
  now: Date = new Date(),
) {
  return (
    lobby.kind === "PICKUP" &&
    !lobby.startedAt &&
    !lobby.isFinished &&
    !isLobbyExpired(lobby.createdAt, now)
  );
}

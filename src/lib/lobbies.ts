/**
 * Rules an open pickup lobby is held to. These live in `lib` because both the
 * server actions that enforce them and the pages that explain them to players
 * need the same numbers.
 */

import { GAME_RULES } from "./validation/gameRules";

/**
 * A lobby seats what any Blitzer game seats — see `GAME_RULES.MAX_PLAYERS` for
 * why that number is eight. Kept as its own name because the lobby copy and
 * rejection messages read better talking about pickup players.
 */
export const MAX_PICKUP_PLAYERS = GAME_RULES.MAX_PLAYERS;

/**
 * A pickup lobby is a same-sitting thing. Its join token and code stay live
 * until the host starts, so without an expiry a QR screenshot forwarded weeks
 * later would still add players to a game nobody is at.
 */
export const LOBBY_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Why a lobby action was turned down. A full table or a dead QR code is an
 * ordinary outcome, not a crash, so these come back as values rather than
 * thrown errors: throwing routes them through `onRequestError` into Sentry
 * and PostHog `$exception`, and Next.js masks the message in production
 * builds. Genuine faults — unauthenticated callers, a roster mismatch — still
 * throw, because those *are* worth an alert.
 */
export type LobbyRejectionReason =
  | "invalid_link"
  | "not_open"
  | "expired"
  | "full"
  | "code_not_found"
  | "not_host"
  | "too_few_players"
  | "invalid_threshold"
  | "too_many_guests"
  | "guest_name_too_long";

export type Rejected<R extends string = LobbyRejectionReason> = {
  ok: false;
  reason: R;
  /** Ready to show the player as-is. */
  message: string;
};

export type Result<T, R extends string = LobbyRejectionReason> =
  | ({ ok: true } & T)
  | Rejected<R>;

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

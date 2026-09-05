import type { Game } from "@/generated/prisma/client";

/**
 * Assert that an already-loaded game belongs to the active circle.
 * @throws {Error} If the game is missing or belongs to another circle
 */
export function assertGameInCircle<G extends Pick<Game, "organizationId">>(
  game: G | null,
  orgId: string,
): asserts game is G {
  if (!game) throw new Error("Game not found");
  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }
}

/** The shape any game needs to have for its scoring access to be judged. */
export type ScoringAccessGame = Pick<
  Game,
  "kind" | "organizationId" | "startedAt"
> & {
  players: { user: { clerk_user_id: string } | null }[];
};

/**
 * Assert the caller may write scores for an already-loaded game, without
 * changing Circle-game semantics: Circle games stay gated on active-Circle
 * membership, pickup games on being a registered player in a started game.
 *
 * @throws {Error} If the game is missing, or the caller may not score it
 */
export function assertGameScoringAccess<G extends ScoringAccessGame>(
  game: G | null,
  caller: { userId: string; orgId?: string },
): asserts game is G {
  if (!game) throw new Error("Game not found");

  if (game.kind === "CIRCLE") {
    if (!caller.orgId) throw new Error("No active circle");
    assertGameInCircle(game, caller.orgId);
    return;
  }

  if (
    game.kind !== "PICKUP" ||
    !game.startedAt ||
    !game.players.some((player) => player.user?.clerk_user_id === caller.userId)
  ) {
    throw new Error("You are not a player in this game");
  }
}

import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import posthogClient from "@/app/posthog";
import type { Game } from "@/generated/prisma/client";

// One auth seam for all server actions. Declare what the action needs and
// destructure a context guaranteed to satisfy it — instead of picking the
// right helper from three overlapping ones and re-implementing org checks.

type Requirement = "user" | "prismaId" | "org" | "orgWithPrismaId";

// Clerk's auth() returns a signed-in/signed-out union discriminated by
// userId — the context carries the signed-in variant
type SignedInAuth = Extract<
  Awaited<ReturnType<typeof auth>>,
  { userId: string }
>;

export type AuthedUserContext = {
  user: SignedInAuth;
  /** Clerk user id, narrowed to non-null */
  userId: string;
  posthog: ReturnType<typeof posthogClient>;
};
export type AuthedPrismaIdContext = AuthedUserContext & {
  /** Internal (Prisma) user id */
  prismaUserId: string;
};
export type AuthedOrgContext = AuthedUserContext & {
  /** Active circle (Clerk organization) id */
  orgId: string;
};
export type AuthedOrgPrismaIdContext = AuthedOrgContext & AuthedPrismaIdContext;

/**
 * Resolve the authenticated context a server action requires.
 * @throws {Error} "Unauthorized" if not signed in
 * @throws {Error} "No active circle" if an org is required but none is active
 * @throws {Error} "User not found" if a Prisma id is required but missing
 */
export async function requireAuthContext(
  requires: "user"
): Promise<AuthedUserContext>;
export async function requireAuthContext(
  requires: "prismaId"
): Promise<AuthedPrismaIdContext>;
export async function requireAuthContext(
  requires: "org"
): Promise<AuthedOrgContext>;
export async function requireAuthContext(
  requires: "orgWithPrismaId"
): Promise<AuthedOrgPrismaIdContext>;
export async function requireAuthContext(
  requires: Requirement
): Promise<AuthedUserContext & { orgId?: string; prismaUserId?: string }> {
  const user = await auth();
  const posthog = posthogClient();

  if (!user.userId) throw new Error("Unauthorized");
  const userId = user.userId;

  const context: AuthedUserContext & {
    orgId?: string;
    prismaUserId?: string;
  } = { user, userId, posthog };

  if (requires === "org" || requires === "orgWithPrismaId") {
    if (!user.orgId) throw new Error("No active circle");
    context.orgId = user.orgId;
  }

  if (requires === "prismaId" || requires === "orgWithPrismaId") {
    const prismaUser = await prisma.user.findUnique({
      where: { clerk_user_id: userId },
      select: { id: true },
    });
    if (!prismaUser) throw new Error("User not found");
    context.prismaUserId = prismaUser.id;
  }

  return context;
}

/**
 * Assert that an already-loaded game belongs to the active circle.
 * @throws {Error} If the game is missing or belongs to another circle
 */
export function assertGameInCircle<G extends Pick<Game, "organizationId">>(
  game: G | null,
  orgId: string
): asserts game is G {
  if (!game) throw new Error("Game not found");
  if (game.organizationId !== orgId) {
    throw new Error("Game does not belong to your active circle");
  }
}

/**
 * Load a game and assert it belongs to the active circle.
 * @throws {Error} If the game is missing or belongs to another circle
 */
export async function requireGameInCircle(
  gameId: string,
  orgId: string
): Promise<Game> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  assertGameInCircle(game, orgId);
  return game;
}

import { auth, currentUser } from "@clerk/nextjs/server";
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

/**
 * Resolve (or provision) the local user for authenticated pickup-game flows.
 * Clerk webhooks normally create this row; doing it here as well removes the
 * race for somebody who signs up from a QR code and immediately taps Join.
 */
export async function ensureCurrentPrismaUser() {
  const { userId } = await requireAuthContext("user");
  const existing = await prisma.user.findUnique({
    where: { clerk_user_id: userId },
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unable to load your account");
  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) throw new Error("Your account needs an email address");

  const emailMatch = await prisma.user.findUnique({ where: { email } });
  if (emailMatch) {
    return prisma.user.update({
      where: { id: emailMatch.id },
      data: { clerk_user_id: userId },
    });
  }

  const preferredName =
    clerkUser.username ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    `player-${userId.slice(-6)}`;

  try {
    return await prisma.user.create({
      data: {
        clerk_user_id: userId,
        email,
        username: `${preferredName}-${userId.slice(-4)}`,
        avatarUrl: clerkUser.imageUrl,
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const racedUser = await prisma.user.findUnique({
        where: { clerk_user_id: userId },
      });
      if (racedUser) return racedUser;
    }
    throw error;
  }
}

/** Authorize the shared scorer without changing Circle-game semantics. */
export async function requireGameScoringAccess(gameId: string) {
  const { userId } = await requireAuthContext("user");
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        select: { userId: true, guestId: true, user: { select: { clerk_user_id: true } } },
      },
    },
  });
  if (!game) throw new Error("Game not found");

  if (game.kind === "CIRCLE" || !game.kind) {
    const session = await auth();
    assertGameInCircle(game, session.orgId ?? "");
  } else if (
    game.kind !== "PICKUP" ||
    !game.startedAt ||
    !game.players.some((player) => player.user?.clerk_user_id === userId)
  ) {
    throw new Error("You are not a player in this game");
  }

  return game;
}

export function assertScoreRoster(
  players: { userId: string | null; guestId: string | null }[],
  scores: { userId?: string; guestId?: string }[]
) {
  const participantKey = (entry: { userId?: string | null; guestId?: string | null }) =>
    entry.userId ? `user:${entry.userId}` : entry.guestId ? `guest:${entry.guestId}` : "";
  const roster = new Set(players.map(participantKey));
  const submitted = scores.map(participantKey);
  if (
    submitted.some((key) => !key) ||
    new Set(submitted).size !== submitted.length ||
    submitted.length !== roster.size ||
    submitted.some((key) => !roster.has(key))
  ) {
    throw new Error("Scores must match the players in this game");
  }
}

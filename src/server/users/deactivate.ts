import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { isUniqueConstraintError } from "./provision";

/** Name shown in place of a player who asked to be anonymized. */
export const FORMER_PLAYER_NAME = "Former player";

export class AccountDeactivatedError extends Error {
  constructor() {
    super("This account has been deleted.");
    this.name = "AccountDeactivatedError";
  }
}

/**
 * Leaving keeps the player's rows so everyone else's games still add up.
 * Deactivation hides them from new games and releases their email, so the
 * same address can sign up again as a fresh account (identities are never
 * relinked by email). Anonymizing also strips the name and avatar, leaving
 * their scores under a numbered "Former player".
 * Idempotent, so a retry or the later user.deleted webhook is harmless.
 *
 * @returns false when no local account exists for this Clerk user
 */
export async function deactivateUser(
  clerkUserId: string,
  { anonymize }: { anonymize: boolean },
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true, deactivatedAt: true, anonymizedAt: true },
  });
  if (!user) return false;

  const now = new Date();
  if (!user.deactivatedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { deactivatedAt: now, email: releasedEmail(user.id) },
    });
  }
  if (anonymize && !user.anonymizedAt) await anonymizeUser(user.id, now);
  return true;
}

function releasedEmail(userId: string) {
  return `former-player-${userId}@deactivated.invalid`;
}

async function anonymizeUser(userId: string, now: Date) {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Numbered so two former players in one game stay distinguishable. The
    // count can race another anonymization; the unique index catches that.
    const previous = await prisma.user.count({
      where: { anonymizedAt: { not: null } },
    });
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            username: `${FORMER_PLAYER_NAME} ${previous + 1 + attempt}`,
            avatarUrl: null,
            dashboardLayout: Prisma.DbNull,
            anonymizedAt: now,
          },
        }),
        // Cached stories name the player; they are rewritten on next view.
        prisma.gameStory.deleteMany({
          where: { game: { players: { some: { userId } } } },
        }),
      ]);
      return;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
  throw new Error("Unable to anonymize this account. Please try again.");
}

/**
 * The player's own "delete my account": deactivate (and optionally
 * anonymize) locally first, then remove the Clerk login so they can't sign
 * back into a dead account. A failed Clerk call is safe to retry.
 */
export async function deleteOwnAccount(
  clerkUserId: string,
  options: { anonymize: boolean },
) {
  await deactivateUser(clerkUserId, options);
  const client = await clerkClient();
  await client.users.deleteUser(clerkUserId);
}

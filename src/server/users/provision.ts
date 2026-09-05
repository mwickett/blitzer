import type { User } from "@/generated/prisma/client";
import { generateRandomUsername } from "@/lib/utils";
import prisma from "@/server/db/db";

type ClerkProfile = {
  email: string;
  username: string | null;
  avatarUrl: string | null;
};

export class AccountEmailConflictError extends Error {
  constructor() {
    super(
      "An account already exists for this email. Sign in with that account to continue.",
    );
    this.name = "AccountEmailConflictError";
  }
}

export function isUniqueConstraintError(error: unknown) {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}

function isUsernameConflict(error: unknown) {
  const target =
    error && typeof error === "object" && "meta" in error
      ? (error.meta as { target?: unknown } | undefined)?.target
      : undefined;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(
    (field) => field === "username" || field === "User_username_key",
  );
}

async function findEmailMatch(clerkUserId: string, email: string) {
  const match = await prisma.user.findUnique({ where: { email } });
  if (match && match.clerk_user_id !== clerkUserId) {
    throw new AccountEmailConflictError();
  }
  return match;
}

async function updateProfile(existing: User, profile: ClerkProfile) {
  const data = {
    email: profile.email,
    username: profile.username || existing.username,
    avatarUrl: profile.avatarUrl,
  };
  if (
    data.email === existing.email &&
    data.username === existing.username &&
    data.avatarUrl === existing.avatarUrl
  ) {
    return existing;
  }

  const where = { clerk_user_id: existing.clerk_user_id };
  try {
    return await prisma.user.update({ where, data });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    await findEmailMatch(existing.clerk_user_id, profile.email);
    if (!isUsernameConflict(error)) throw error;
    // A generated local name may already occupy a new Clerk username. Keep
    // this account's established name instead of changing it on every retry.
    try {
      return await prisma.user.update({
        where,
        data: { email: profile.email, avatarUrl: profile.avatarUrl },
      });
    } catch (retryError) {
      if (isUniqueConstraintError(retryError)) {
        await findEmailMatch(existing.clerk_user_id, profile.email);
      }
      throw retryError;
    }
  }
}

/**
 * Clerk ID owns the local account; an email match never transfers ownership.
 * Provisioning leaves an existing profile alone so a delayed user.created
 * event cannot undo a later update. Only user.updated synchronizes profiles.
 * The lazy profile loader avoids a Clerk lookup for existing pickup players.
 */
export async function resolveClerkUser(
  clerkUserId: string,
  loadProfile: () => Promise<ClerkProfile> | ClerkProfile,
  mode: "provision" | "sync" = "provision",
): Promise<User> {
  const existing = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
  });
  if (existing && mode === "provision") return existing;

  const profile = await loadProfile();
  if (!profile.email) throw new Error("Your account needs an email address");
  if (existing) return updateProfile(existing, profile);

  const emailMatch = await findEmailMatch(clerkUserId, profile.email);
  if (emailMatch) {
    return mode === "sync" ? updateProfile(emailMatch, profile) : emailMatch;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.user.create({
        data: {
          clerk_user_id: clerkUserId,
          email: profile.email,
          username:
            attempt === 0 && profile.username
              ? profile.username
              : generateRandomUsername(),
          avatarUrl: profile.avatarUrl,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Another webhook or an immediate pickup join may have won the insert.
      const racedUser = await prisma.user.findUnique({
        where: { clerk_user_id: clerkUserId },
      });
      if (racedUser) {
        return mode === "sync" ? updateProfile(racedUser, profile) : racedUser;
      }
      await findEmailMatch(clerkUserId, profile.email);
      if (!isUsernameConflict(error)) throw error;
    }
  }
  throw new Error("Unable to set up your account. Please try again.");
}

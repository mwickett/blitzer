"use server";

import "server-only";
import prisma from "@/server/db/db";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getUserIdFromAuth } from "@/server/utils";
import { requireActiveOrg } from "@/server/mutations/common";

/**
 * Build invite suggestions from:
 *  - Friends (existing Friend edges)
 *  - Frequent co-players from previous games
 * Filters out users already in the active org.
 */
export async function getOrgInviteSuggestions() {
  const orgId = await requireActiveOrg();
  const currentUserId = await getUserIdFromAuth();

  // Current org members
  const orgMemberships = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId },
    select: { userId: true },
  });
  const orgMemberIds = new Set(orgMemberships.map((m) => m.userId));

  // Friends (pairwise)
  const friendships = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
    },
    select: { user1Id: true, user2Id: true },
  });
  const friendIds = new Set<string>();
  for (const f of friendships) {
    const other = f.user1Id === currentUserId ? f.user2Id : f.user1Id;
    if (other && other !== currentUserId) {
      friendIds.add(other);
    }
  }

  // Co-players from recent games
  const recentGames = await prisma.game.findMany({
    where: {
      players: {
        some: { userId: currentUserId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      players: {
        include: {
          user: { select: { id: true } },
        },
      },
    },
  });

  const coPlayerCounts = new Map<string, number>();
  for (const game of recentGames) {
    for (const gp of game.players) {
      const uid = gp.user?.id;
      if (!uid || uid === currentUserId) continue;
      coPlayerCounts.set(uid, (coPlayerCounts.get(uid) || 0) + 1);
    }
  }

  // Union of friendIds and co-player IDs
  const candidateIds = new Set<string>([
    ...friendIds,
    ...Array.from(coPlayerCounts.keys()),
  ]);

  // Remove org members and self
  candidateIds.delete(currentUserId);
  for (const memberId of orgMemberIds) {
    candidateIds.delete(memberId);
  }

  if (candidateIds.size === 0) return [];

  // Load user records
  const candidates = await prisma.user.findMany({
    where: { id: { in: Array.from(candidateIds) } },
    select: { id: true, username: true, email: true, avatarUrl: true },
  });

  // Rank: friends get heavy weight; add co-play counts
  const scored = candidates.map((u) => {
    const base = friendIds.has(u.id) ? 100 : 0;
    const count = coPlayerCounts.get(u.id) || 0;
    return { ...u, score: base + count };
  });

  scored.sort((a, b) => b.score - a.score);

  // Return top suggestions (include email for invites)
  return scored.slice(0, 15).map(({ id, username, email, avatarUrl }) => ({
    id,
    username,
    email,
    avatarUrl,
  }));
}

/**
 * Helper to find unassigned games eligible for backfill to org:
 * - organizationId is null
 * - at least one registered player is an org member
 * - all registered players are org members (guests allowed)
 */
async function findEligibleUnassignedGameIds(orgId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId },
    select: { userId: true },
  });
  const memberIds = new Set(memberships.map((m) => m.userId));
  if (memberIds.size === 0) return [];

  // Narrow: only unassigned games where at least 1 player is a member
  const candidates = await prisma.game.findMany({
    where: {
      organizationId: null,
      players: {
        some: { userId: { in: Array.from(memberIds) } },
      },
    },
    select: {
      id: true,
      players: {
        select: { userId: true, guestId: true },
      },
    },
  });

  const eligible: string[] = [];
  for (const game of candidates) {
    const registered = game.players
      .map((p) => p.userId)
      .filter((id): id is string => Boolean(id));
    if (registered.length === 0) {
      // Skip guest-only games (no way to infer proper org)
      continue;
    }
    const allInOrg = registered.every((uid) => memberIds.has(uid));
    if (allInOrg) eligible.push(game.id);
  }
  return eligible;
}

export async function getBackfillEligibleCount() {
  const orgId = await requireActiveOrg();
  const eligibleIds = await findEligibleUnassignedGameIds(orgId);
  return eligibleIds.length;
}

export async function backfillGamesForOrg() {
  const orgId = await requireActiveOrg();
  const eligibleIds = await findEligibleUnassignedGameIds(orgId);
  if (eligibleIds.length === 0) {
    return { updated: 0, eligible: 0 };
  }
  const res = await prisma.game.updateMany({
    where: { id: { in: eligibleIds } },
    data: { organizationId: orgId },
  });
  return { updated: res.count, eligible: eligibleIds.length };
}

function uniqueValidEmails(emails: string[]) {
  const set = new Set<string>();
  for (const e of emails) {
    const email = (e || "").trim();
    if (!email) continue;
    // very light validation
    if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
      continue;
    }
    set.add(email.toLowerCase());
  }
  return Array.from(set);
}

/**
 * One-click invites using Clerk Management API.
 * - Requires CLERK_SECRET_KEY in env
 * - Skips users already in the org
 * - Treats duplicate/pending invitation conflicts as "alreadyInvited"
 */
export async function inviteUsersToActiveOrg(
  emails: string[],
  role: string = "org:member"
) {
  const orgId = await requireActiveOrg();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  const uniqueEmails = uniqueValidEmails(emails);
  if (uniqueEmails.length === 0) {
    return { invited: 0, skipped: 0, alreadyInvited: 0, errors: [] as any[] };
  }

  // Build a set of userIds already members (by email lookup)
  // Note: users without accounts can still be invited by email directly
  const usersByEmail = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true },
  });
  const emailToUserId = new Map(
    usersByEmail.map((u) => [u.email.toLowerCase(), u.id])
  );

  const existingMemberships = await prisma.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      userId: { in: usersByEmail.map((u) => u.id) },
    },
    select: { userId: true },
  });
  const existingMemberUserIds = new Set(
    existingMemberships.map((m) => m.userId)
  );

  let invited = 0;
  let skipped = 0;
  let alreadyInvited = 0;
  const errors: { email: string; error: string }[] = [];

  // Get clerkClient instance (Clerk v6+ requires async call)
  const client = await clerkClient();

  for (const email of uniqueEmails) {
    const userId = emailToUserId.get(email);
    if (userId && existingMemberUserIds.has(userId)) {
      // Already a member
      skipped += 1;
      continue;
    }

    try {
      await client.organizations.createOrganizationInvitation({
        organizationId: orgId,
        emailAddress: email,
        role,
        inviterUserId: clerkUserId,
      });
      invited += 1;
    } catch (err: any) {
      const msg =
        (err && (err.errors?.[0]?.message || err.message)) || "Unknown error";
      // Treat duplicates/pending as already invited
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("exists")
      ) {
        alreadyInvited += 1;
      } else {
        errors.push({ email, error: msg });
      }
    }
  }

  return { invited, skipped, alreadyInvited, errors };
}

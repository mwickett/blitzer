/**
 * Seed script for preview/dev environments.
 *
 * Syncs Clerk dev users, reconciles org memberships, and creates
 * sample game data. Idempotent — safe to re-run.
 *
 * Usage: npm run db:seed
 */

import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// --- Types ---

interface SeedConfig {
  orgA: string;
  orgB: string;
  orgC: string;
  anchorUserId: string;
  user2Id: string;
  user3Id: string;
  prodDbHost: string;
}

interface SyncedUser {
  prismaId: string;
  clerkId: string;
  username: string;
}

// --- Configuration ---

function getConfig(): SeedConfig {
  const orgA = process.env.SEED_ORG_A;
  const orgB = process.env.SEED_ORG_B;
  const orgC = process.env.SEED_ORG_C;
  const anchorUserId = process.env.SEED_ANCHOR_USER;
  const user2Id = process.env.SEED_USER_2;
  const user3Id = process.env.SEED_USER_3;
  const prodDbHost = process.env.SEED_PROD_DB_HOST;

  const missing = [
    !orgA && "SEED_ORG_A",
    !orgB && "SEED_ORG_B",
    !orgC && "SEED_ORG_C",
    !anchorUserId && "SEED_ANCHOR_USER",
    !user2Id && "SEED_USER_2",
    !user3Id && "SEED_USER_3",
    !prodDbHost && "SEED_PROD_DB_HOST",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing required seed env vars: ${missing.join(", ")}`);
  }

  return {
    orgA: orgA!,
    orgB: orgB!,
    orgC: orgC!,
    anchorUserId: anchorUserId!,
    user2Id: user2Id!,
    user3Id: user3Id!,
    prodDbHost: prodDbHost!,
  };
}

// --- Production Safety Guards ---

function guardProduction(config: SeedConfig): boolean {
  // Guard 1: Skip in Vercel production
  if (process.env.VERCEL_ENV === "production") {
    console.log("Skipping seed in production");
    return false;
  }

  // Guard 2: Reject if DATABASE_URL points to production
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes(config.prodDbHost)) {
    throw new Error(
      `DATABASE_URL contains production host "${config.prodDbHost}". Refusing to seed.`
    );
  }

  return true;
}

// --- Prisma Client ---

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// --- Clerk User Sync ---

async function syncClerkUsers(
  clerk: ReturnType<typeof createClerkClient>,
  prisma: PrismaClient
): Promise<SyncedUser[]> {
  const clerkUsers = await clerk.users.getUserList({ limit: 100 });
  console.log(`Found ${clerkUsers.data.length} users in Clerk`);

  const synced: SyncedUser[] = [];

  for (const user of clerkUsers.data) {
    const email =
      user.emailAddresses[0]?.emailAddress || `${user.id}@placeholder.dev`;
    const username = user.username || user.id.slice(-8);
    const avatarUrl = user.imageUrl || null;

    const dbUser = await prisma.user.upsert({
      where: { clerk_user_id: user.id },
      update: { email, username, avatarUrl },
      create: { clerk_user_id: user.id, email, username, avatarUrl },
    });

    synced.push({ prismaId: dbUser.id, clerkId: user.id, username });
    console.log(`  ✓ ${username} (${email})`);
  }

  console.log(`✓ Synced ${synced.length} users\n`);
  return synced;
}

// --- Org Membership Reconciliation ---

async function ensureMembership(
  clerk: ReturnType<typeof createClerkClient>,
  orgId: string,
  userId: string
): Promise<void> {
  const members = await clerk.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
  });
  const isMember = members.data.some(
    (m) => m.publicUserData?.userId === userId
  );

  if (!isMember) {
    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId,
      role: "org:member",
    });
    console.log(`  + Added ${userId} to ${orgId}`);
  } else {
    console.log(`  ✓ ${userId} already in ${orgId}`);
  }
}

async function reconcileOrgMemberships(
  clerk: ReturnType<typeof createClerkClient>,
  config: SeedConfig
): Promise<void> {
  console.log("Reconciling org memberships...");

  // Anchor user in all 3 orgs
  for (const orgId of [config.orgA, config.orgB, config.orgC]) {
    await ensureMembership(clerk, orgId, config.anchorUserId);
  }

  // User 2 and User 3 in Org A
  await ensureMembership(clerk, config.orgA, config.user2Id);
  await ensureMembership(clerk, config.orgA, config.user3Id);

  // User 2 in Org B
  await ensureMembership(clerk, config.orgB, config.user2Id);

  console.log("✓ Org memberships reconciled\n");
}

// --- Main ---

async function main() {
  const config = getConfig();
  if (!guardProduction(config)) return;

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) throw new Error("CLERK_SECRET_KEY is required");

  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  const prisma = createPrismaClient();

  try {
    // Validate that seed orgs exist in Clerk
    for (const [label, orgId] of [
      ["SEED_ORG_A", config.orgA],
      ["SEED_ORG_B", config.orgB],
      ["SEED_ORG_C", config.orgC],
    ] as const) {
      try {
        await clerk.organizations.getOrganization({ organizationId: orgId });
      } catch {
        throw new Error(`${label}="${orgId}" not found in Clerk`);
      }
    }

    // Validate all configured users exist in Clerk
    for (const [label, userId] of [
      ["SEED_ANCHOR_USER", config.anchorUserId],
      ["SEED_USER_2", config.user2Id],
      ["SEED_USER_3", config.user3Id],
    ] as const) {
      try {
        await clerk.users.getUser(userId);
      } catch {
        throw new Error(`${label}="${userId}" not found in Clerk`);
      }
    }

    console.log("✓ Config validated — all orgs and users exist in Clerk\n");

    // Step 1: Sync Clerk users to database
    const users = await syncClerkUsers(clerk, prisma);

    // Step 2: Reconcile Clerk org memberships
    await reconcileOrgMemberships(clerk, config);
  } finally {
    await prisma.$disconnect();
  }
}

// Error handling: fail hard locally, swallow in Vercel previews
if (process.env.VERCEL_ENV) {
  main().catch((err) => {
    console.error("Seed failed (non-fatal):", err.message || err);
  });
} else {
  main();
}

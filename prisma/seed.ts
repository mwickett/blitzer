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

// --- Utilities ---

/**
 * Generates a deterministic UUID for seed data.
 * Format: 5eed0000-CCCC-4000-a000-IIIIIIIIIIII
 * where C = category (hex), I = index (hex).
 * The "5eed" prefix makes seed records instantly identifiable.
 */
function seedId(category: number, index: number): string {
  const cat = category.toString(16).padStart(4, "0");
  const idx = index.toString(16).padStart(12, "0");
  return `5eed0000-${cat}-4000-a000-${idx}`;
}

// Seed ID categories
const CAT_GUEST = 1;
const CAT_GAME = 2;
const CAT_PLAYER = 3;
const CAT_ROUND = 4;
const CAT_SCORE = 5;

// Counts for deletion (must match creation below)
const SEED_COUNTS = {
  guests: 3,
  games: 4,
  players: 13,
  rounds: 17,
  scores: 55,
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
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

// --- Game Data Fixtures ---

async function seedGameData(
  prisma: PrismaClient,
  config: SeedConfig,
  users: SyncedUser[]
): Promise<void> {
  // Resolve configured users to their Prisma IDs
  const anchor = users.find((u) => u.clerkId === config.anchorUserId);
  const user2 = users.find((u) => u.clerkId === config.user2Id);
  const user3 = users.find((u) => u.clerkId === config.user3Id);

  if (!anchor || !user2 || !user3) {
    const missing = [
      !anchor && "SEED_ANCHOR_USER",
      !user2 && "SEED_USER_2",
      !user3 && "SEED_USER_3",
    ].filter(Boolean);
    throw new Error(
      `Configured users not found in synced users: ${missing.join(", ")}. ` +
      `Ensure these Clerk users exist and were synced.`
    );
  }

  console.log("Seeding game data (delete-and-recreate in transaction)...");

  await prisma.$transaction(async (tx) => {
    // --- Delete existing seed records (FK order) ---
    const scoreIds = Array.from({ length: SEED_COUNTS.scores }, (_, i) =>
      seedId(CAT_SCORE, i + 1)
    );
    const playerIds = Array.from({ length: SEED_COUNTS.players }, (_, i) =>
      seedId(CAT_PLAYER, i + 1)
    );
    const roundIds = Array.from({ length: SEED_COUNTS.rounds }, (_, i) =>
      seedId(CAT_ROUND, i + 1)
    );
    const gameIds = Array.from({ length: SEED_COUNTS.games }, (_, i) =>
      seedId(CAT_GAME, i + 1)
    );
    const guestIds = Array.from({ length: SEED_COUNTS.guests }, (_, i) =>
      seedId(CAT_GUEST, i + 1)
    );

    await tx.score.deleteMany({ where: { id: { in: scoreIds } } });
    await tx.gamePlayers.deleteMany({ where: { id: { in: playerIds } } });
    await tx.round.deleteMany({ where: { id: { in: roundIds } } });
    await tx.game.deleteMany({ where: { id: { in: gameIds } } });
    await tx.guestUser.deleteMany({ where: { id: { in: guestIds } } });

    console.log("  ✓ Cleared old seed data");

    // --- Create Guest Users ---
    await tx.guestUser.createMany({
      data: [
        {
          id: seedId(CAT_GUEST, 1),
          name: "Guest Alice",
          createdById: anchor.prismaId,
          organizationId: config.orgA,
        },
        {
          id: seedId(CAT_GUEST, 2),
          name: "Guest Bob",
          createdById: anchor.prismaId,
          organizationId: config.orgA,
        },
        {
          id: seedId(CAT_GUEST, 3),
          name: "Guest Carol",
          createdById: anchor.prismaId,
          organizationId: config.orgB,
        },
      ],
    });

    console.log("  ✓ Created 3 guest users");

    // --- Create Games ---
    await tx.game.createMany({
      data: [
        // Org A Game 1: completed, 3 real players, 5 rounds, anchor wins
        {
          id: seedId(CAT_GAME, 1),
          organizationId: config.orgA,
          isFinished: true,
          winnerId: anchor.prismaId,
          endedAt: daysAgo(7),
        },
        // Org A Game 2: completed, 4 players (3 real + guest), 4 rounds, user2 wins
        {
          id: seedId(CAT_GAME, 2),
          organizationId: config.orgA,
          isFinished: true,
          winnerId: user2.prismaId,
          endedAt: daysAgo(3),
        },
        // Org A Game 3: in-progress, 3 real players, 2 rounds
        {
          id: seedId(CAT_GAME, 3),
          organizationId: config.orgA,
          isFinished: false,
        },
        // Org B Game 1: completed, 2 real + 1 guest, 6 rounds, anchor wins
        {
          id: seedId(CAT_GAME, 4),
          organizationId: config.orgB,
          isFinished: true,
          winnerId: anchor.prismaId,
          endedAt: daysAgo(1),
        },
      ],
    });

    console.log("  ✓ Created 4 games");

    // --- Create Game Players ---
    await tx.gamePlayers.createMany({
      data: [
        // Game A1: anchor, user2, user3
        { id: seedId(CAT_PLAYER, 1), gameId: seedId(CAT_GAME, 1), userId: anchor.prismaId },
        { id: seedId(CAT_PLAYER, 2), gameId: seedId(CAT_GAME, 1), userId: user2.prismaId },
        { id: seedId(CAT_PLAYER, 3), gameId: seedId(CAT_GAME, 1), userId: user3.prismaId },
        // Game A2: anchor, user2, user3, Guest Alice
        { id: seedId(CAT_PLAYER, 4), gameId: seedId(CAT_GAME, 2), userId: anchor.prismaId },
        { id: seedId(CAT_PLAYER, 5), gameId: seedId(CAT_GAME, 2), userId: user2.prismaId },
        { id: seedId(CAT_PLAYER, 6), gameId: seedId(CAT_GAME, 2), userId: user3.prismaId },
        { id: seedId(CAT_PLAYER, 7), gameId: seedId(CAT_GAME, 2), guestId: seedId(CAT_GUEST, 1) },
        // Game A3: anchor, user2, user3
        { id: seedId(CAT_PLAYER, 8), gameId: seedId(CAT_GAME, 3), userId: anchor.prismaId },
        { id: seedId(CAT_PLAYER, 9), gameId: seedId(CAT_GAME, 3), userId: user2.prismaId },
        { id: seedId(CAT_PLAYER, 10), gameId: seedId(CAT_GAME, 3), userId: user3.prismaId },
        // Game B1: anchor, user2, Guest Carol
        { id: seedId(CAT_PLAYER, 11), gameId: seedId(CAT_GAME, 4), userId: anchor.prismaId },
        { id: seedId(CAT_PLAYER, 12), gameId: seedId(CAT_GAME, 4), userId: user2.prismaId },
        { id: seedId(CAT_PLAYER, 13), gameId: seedId(CAT_GAME, 4), guestId: seedId(CAT_GUEST, 3) },
      ],
    });

    console.log("  ✓ Created 13 game players");

    // --- Create Rounds and Scores ---
    // Score fixture data: [totalCardsPlayed, blitzPileRemaining] per player per round.
    // Net score = totalCardsPlayed - (2 * blitzPileRemaining). Win threshold = 75.

    interface GameFixture {
      gameId: string;
      playerIds: { id: string; isGuest: boolean }[];
      // Each inner array = one round; each tuple = one player's score
      rounds: [number, number][][];
    }

    const fixtures: GameFixture[] = [
      {
        // Game A1: 3 real players, 5 rounds. Anchor cumulative: 18+11+22+14+12=77 (wins)
        gameId: seedId(CAT_GAME, 1),
        playerIds: [
          { id: anchor.prismaId, isGuest: false },
          { id: user2.prismaId, isGuest: false },
          { id: user3.prismaId, isGuest: false },
        ],
        rounds: [
          [[18, 0], [12, 3], [8, 5]],     // R1: anchor=18, user2=6, user3=-2
          [[15, 2], [20, 0], [10, 4]],     // R2: anchor=11, user2=20, user3=2
          [[22, 0], [8, 6], [14, 1]],      // R3: anchor=22, user2=-4, user3=12
          [[16, 1], [14, 2], [6, 7]],      // R4: anchor=14, user2=10, user3=-8
          [[12, 0], [18, 0], [16, 3]],     // R5: anchor=12, user2=18, user3=10
        ],
      },
      {
        // Game A2: 4 players, 4 rounds. User2 cumulative: 22+18+18+20=78 (wins)
        gameId: seedId(CAT_GAME, 2),
        playerIds: [
          { id: anchor.prismaId, isGuest: false },
          { id: user2.prismaId, isGuest: false },
          { id: user3.prismaId, isGuest: false },
          { id: seedId(CAT_GUEST, 1), isGuest: true },
        ],
        rounds: [
          [[10, 3], [22, 0], [6, 5], [14, 2]],    // R1: 4, 22, -4, 10
          [[16, 1], [18, 0], [12, 4], [8, 6]],     // R2: 14, 18, 4, -4
          [[8, 5], [20, 1], [18, 0], [10, 3]],     // R3: -2, 18, 18, 4
          [[14, 0], [20, 0], [4, 8], [12, 2]],     // R4: 14, 20, -12, 8
        ],
      },
      {
        // Game A3: 3 real players, 2 rounds, in-progress. No winner yet.
        gameId: seedId(CAT_GAME, 3),
        playerIds: [
          { id: anchor.prismaId, isGuest: false },
          { id: user2.prismaId, isGuest: false },
          { id: user3.prismaId, isGuest: false },
        ],
        rounds: [
          [[14, 2], [10, 4], [18, 0]],    // R1: anchor=10, user2=2, user3=18
          [[20, 0], [8, 5], [12, 3]],      // R2: anchor=20, user2=-2, user3=6
        ],
      },
      {
        // Game B1: 2 real + 1 guest, 6 rounds. Anchor cumulative: 16+12+20+6+18+4=76 (wins)
        gameId: seedId(CAT_GAME, 4),
        playerIds: [
          { id: anchor.prismaId, isGuest: false },
          { id: user2.prismaId, isGuest: false },
          { id: seedId(CAT_GUEST, 3), isGuest: true },
        ],
        rounds: [
          [[16, 0], [10, 3], [8, 5]],      // R1: 16, 4, -2
          [[14, 1], [18, 0], [6, 4]],       // R2: 12, 18, -2
          [[20, 0], [8, 6], [12, 2]],       // R3: 20, -4, 8
          [[10, 2], [16, 1], [14, 0]],      // R4: 6, 14, 14
          [[18, 0], [12, 3], [4, 7]],       // R5: 18, 6, -10
          [[10, 3], [14, 2], [10, 1]],      // R6: 4, 10, 8
        ],
      },
    ];

    let roundCounter = 1;
    let scoreCounter = 1;

    for (const fixture of fixtures) {
      for (let r = 0; r < fixture.rounds.length; r++) {
        const roundId = seedId(CAT_ROUND, roundCounter++);

        await tx.round.create({
          data: {
            id: roundId,
            gameId: fixture.gameId,
            round: r + 1,
          },
        });

        for (let p = 0; p < fixture.playerIds.length; p++) {
          const [totalCardsPlayed, blitzPileRemaining] = fixture.rounds[r][p];
          const player = fixture.playerIds[p];

          await tx.score.create({
            data: {
              id: seedId(CAT_SCORE, scoreCounter++),
              roundId,
              userId: player.isGuest ? null : player.id,
              guestId: player.isGuest ? player.id : null,
              totalCardsPlayed,
              blitzPileRemaining,
            },
          });
        }
      }
    }

    console.log(`  ✓ Created ${roundCounter - 1} rounds and ${scoreCounter - 1} scores`);
  });

  console.log("✓ Game data seeded\n");
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

    // Step 3: Seed game data (delete-and-recreate in transaction)
    await seedGameData(prisma, config, users);

    console.log("Done! All seed data is in place.");
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

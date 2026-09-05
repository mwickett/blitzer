import type { PrismaClient } from "../src/generated/prisma/client";

// --- Types ---

export interface SeedConfig {
  orgA: string;
  orgB: string;
  orgC: string;
  anchorUserId: string;
  user2Id: string;
  user3Id: string;
  prodDbHost: string;
}

export interface SyncedUser {
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
export function seedId(category: number, index: number): string {
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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// --- Game Data Fixtures ---

export async function seedGameData(
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

  console.log("Initializing missing game fixtures...");

  await prisma.$transaction(async (tx) => {
    // Serialize initializers; preserve existing games and all their descendants.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714071, 295)`;
    const existingGames = await tx.game.findMany({
      where: { id: { in: [1, 2, 3, 4].map((n) => seedId(CAT_GAME, n)) } },
      select: { id: true },
    });
    const existingGameIds = new Set(existingGames.map((game) => game.id));

    // --- Create Guest Users ---
    await tx.guestUser.createMany({
      skipDuplicates: true,
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

    console.log("  ✓ Ensured fixture guests exist");

    // --- Create Games ---
    await tx.game.createMany({
      skipDuplicates: true,
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

    console.log("  ✓ Ensured fixture games exist");

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
      ].filter((player) => !existingGameIds.has(player.gameId)),
    });

    console.log("  ✓ Initialized players for new fixtures");

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
          [[16, 1], [10, 0], [6, 7]],      // R4: anchor=14, user2=10, user3=-8
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
          [[10, 3], [10, 0], [10, 1]],      // R6: 4, 10, 8
        ],
      },
    ];

    let roundCounter = 1;
    let scoreCounter = 1;

    for (const fixture of fixtures) {
      for (let r = 0; r < fixture.rounds.length; r++) {
        const roundId = seedId(CAT_ROUND, roundCounter++);
        if (existingGameIds.has(fixture.gameId)) {
          scoreCounter += fixture.playerIds.length;
          continue;
        }

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

    console.log("  ✓ Initialized rounds and scores for new fixtures");
  });

  console.log("✓ Game data seeded\n");
}

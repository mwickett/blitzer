import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create Users
  const alice = await prisma.user.upsert({
    where: { email: "alice@prisma.io" },
    update: {},
    create: {
      email: "alice@prisma.io",
      username: "Alice",
      clerk_user_id: "sadfoa8sdf",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@prisma.io" },
    update: {},
    create: {
      email: "bob@prisma.io",
      username: "Bob",
      clerk_user_id: "sdf9sdf9",
    },
  });

  const terry = await prisma.user.upsert({
    where: { email: "terry@prisma.io" },
    update: {},
    create: {
      email: "terry@prisma.io",
      username: "Terry",
      clerk_user_id: "sdf9sdfsi8df9",
    },
  });

  // Create Friendships
  await prisma.friendship.create({
    data: {
      user1_id: alice.id,
      user2_id: bob.id,
      status: "ACCEPTED",
    },
  });

  await prisma.friendship.create({
    data: {
      user1_id: alice.id,
      user2_id: terry.id,
      status: "PENDING",
    },
  });

  await prisma.friendship.create({
    data: {
      user1_id: bob.id,
      user2_id: terry.id,
      status: "ACCEPTED",
    },
  });

  // Create Games
  const game1 = await prisma.game.create({
    data: {
      isFinished: false,
      winnerId: null,
      players: {
        create: [
          { userId: alice.id },
          { userId: bob.id },
          { userId: terry.id },
        ],
      },
    },
  });

  const game2 = await prisma.game.create({
    data: {
      isFinished: true,
      winnerId: bob.id,
      players: {
        create: [{ userId: alice.id }, { userId: bob.id }],
      },
    },
  });

  // Create Scores
  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: alice.id,
      totalCardsPlayed: 25,
      blitzPileRemaining: 5,
      value: 20,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: bob.id,
      totalCardsPlayed: 30,
      blitzPileRemaining: 0,
      value: 30,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: terry.id,
      totalCardsPlayed: 20,
      blitzPileRemaining: 10,
      value: 10,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game2.id,
      userId: alice.id,
      totalCardsPlayed: 40,
      blitzPileRemaining: 0,
      value: 40,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game2.id,
      userId: bob.id,
      totalCardsPlayed: 35,
      blitzPileRemaining: 5,
      value: 30,
    },
  });

  // Create Statistics
  await prisma.statistics.create({
    data: {
      userId: alice.id,
      totalGames: 2,
      totalWins: 0,
      averageScore: 30,
      fastestBlitz: 0,
      mostCardsPlayed: 40,
      efficiency: 0.75,
    },
  });

  await prisma.statistics.create({
    data: {
      userId: bob.id,
      totalGames: 2,
      totalWins: 1,
      averageScore: 30,
      fastestBlitz: 0,
      mostCardsPlayed: 35,
      efficiency: 0.85,
    },
  });

  await prisma.statistics.create({
    data: {
      userId: terry.id,
      totalGames: 1,
      totalWins: 0,
      averageScore: 10,
      fastestBlitz: 10,
      mostCardsPlayed: 20,
      efficiency: 0.5,
    },
  });

  console.log({ alice, bob, terry });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

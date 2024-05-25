import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Create Users
  const alice = await prisma.user.upsert({
    where: { email: "alice@prisma.io" },
    update: {},
    create: {
      email: "alice@prisma.io",
      clerk_user_id: "sadfoa8sdf",
    },
  });

  const mike = await prisma.user.upsert({
    where: { email: "mike@wickett.ca" },
    update: {},
    create: {
      email: "mike@wickett.ca",
      clerk_user_id: "user_2gtFRHlopGWSPKDCdUA275VTCrn",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@prisma.io" },
    update: {},
    create: {
      email: "bob@prisma.io",
      clerk_user_id: "sdf9sdf9",
    },
  });

  const terry = await prisma.user.upsert({
    where: { email: "terry@prisma.io" },
    update: {},
    create: {
      email: "terry@prisma.io",
      clerk_user_id: "sdf9sdfsi8df9",
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
          { userId: mike.id },
        ],
      },
    },
  });

  const game3 = await prisma.game.create({
    data: {
      isFinished: true,
      winnerId: mike.id,
      players: {
        create: [
          { userId: alice.id },
          { userId: bob.id },
          { userId: terry.id },
          { userId: mike.id },
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
    },
  });

  await prisma.score.create({
    data: {
      gameId: game3.id,
      userId: mike.id,
      totalCardsPlayed: 25,
      blitzPileRemaining: 5,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: mike.id,
      totalCardsPlayed: 22,
      blitzPileRemaining: 3,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: bob.id,
      totalCardsPlayed: 30,
      blitzPileRemaining: 0,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game1.id,
      userId: terry.id,
      totalCardsPlayed: 20,
      blitzPileRemaining: 10,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game2.id,
      userId: alice.id,
      totalCardsPlayed: 40,
      blitzPileRemaining: 0,
    },
  });

  await prisma.score.create({
    data: {
      gameId: game2.id,
      userId: bob.id,
      totalCardsPlayed: 35,
      blitzPileRemaining: 5,
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

// A simple script to test the GamePlayers model
// Run with: node src/server/test-gameplayers.js

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting test...");
    
    // First create a test game
    const game = await prisma.game.create({
      data: {}
    });
    console.log("Created test game:", game.id);
    
    // Create a test guest user
    const guestUser = await prisma.guestUser.create({
      data: {
        name: "Test Guest",
        // You'll need to provide a valid user ID here
        createdById: "1a45dd50-60ff-4fb6-b848-9e9ab7c8c6f3"
      }
    });
    console.log("Created test guest user:", guestUser.id);
    
    // Test creating a GamePlayers entry for a regular user
    const regularPlayer = await prisma.gamePlayers.create({
      data: {
        gameId: game.id,
        userId: "1a45dd50-60ff-4fb6-b848-9e9ab7c8c6f3",
      }
    });
    console.log("Created regular player entry:", regularPlayer.id);
    
    // Test creating a GamePlayers entry for a guest user
    const guestPlayer = await prisma.gamePlayers.create({
      data: {
        gameId: game.id,
        guestId: guestUser.id,
      }
    });
    console.log("Created guest player entry:", guestPlayer.id);
    
    console.log("All tests passed!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

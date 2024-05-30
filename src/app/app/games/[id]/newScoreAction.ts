"use server";
import prisma from "@/db";

// TODO: Check if a player has passed 75 points played and if so, end the game

export default async function createScoresForGame(
  gameId: string,
  scores: {
    userId: string;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[]
) {
  const scoreEntries = await prisma.score.createMany({
    data: scores.map((score) => ({
      gameId: gameId,
      userId: score.userId,
      blitzPileRemaining: score.blitzPileRemaining,
      totalCardsPlayed: score.totalCardsPlayed,
    })),
  });

  console.log(scoreEntries);
}

"use server";
import prisma from "@/db";
import { revalidatePath } from "next/cache";

export default async function createScoresForGame(
  gameId: string,
  scores: {
    userId: string;
    blitzPileRemaining: number;
    totalCardsPlayed: number;
  }[]
) {
  await prisma.score.createMany({
    data: scores.map((score) => ({
      gameId: gameId,
      userId: score.userId,
      blitzPileRemaining: score.blitzPileRemaining,
      totalCardsPlayed: score.totalCardsPlayed,
    })),
  });

  revalidatePath(`/games/${gameId}`);
}

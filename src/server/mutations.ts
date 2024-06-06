"use server";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Create a new game

export async function createGame(users: { id: string }[]) {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.create({
    data: {
      players: {
        create: users.map((user) => ({
          user: {
            connect: {
              id: user.id,
            },
          },
        })),
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
    },
  });

  revalidatePath("/games");
  redirect(`/games/${game.id}`);
}

// Create new scores
export async function createScoresForGame(
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

// Update game as finished
export async function updateGameAsFinished(gameId: string, winnerId: string) {
  await prisma.game.update({
    where: {
      id: gameId,
    },
    data: {
      isFinished: true,
      winnerId: winnerId,
      endedAt: new Date(),
    },
  });

  revalidatePath(`/games/${gameId}`);
}

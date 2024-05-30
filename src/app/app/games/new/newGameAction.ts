"use server";

import prisma from "@/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createNewGame(users: { id: string }[]) {
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

  console.log(game);
  // TODO: change route to game view /app/games/:gameId
  revalidatePath("/app/games");
  redirect(`/app/games/${game.id}`);
}

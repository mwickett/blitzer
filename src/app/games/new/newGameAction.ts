"use server";

import prisma from "@/prisma/db";
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

  revalidatePath("/games");
  redirect(`/games/${game.id}`);
}

"use server";

import prisma from "@/db";

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
  // change route to game view /app/games/:gameId
}

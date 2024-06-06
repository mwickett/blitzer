import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";

// Fetch all games that the current user is a part of
export async function getGames() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const games = await prisma.game.findMany({
    where: {
      players: {
        some: {
          user: {
            clerk_user_id: user.userId,
          },
        },
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      scores: true,
    },
  });

  return games;
}

// Fetch all users
// This will be refactored to only fetch users that are friends of the current user
// But for now, all users are global
export async function getAllUsers() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
    },
  });

  return users;
}

// Fetch a single game by ID
export async function getGameById(id: string) {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.findUnique({
    where: {
      id: id,
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      scores: {
        include: {
          user: true,
        },
      },
    },
  });

  return game;
}

import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

// Fetch all games that the current user is a part of
export async function getGames() {
  const user = await auth();
  const posthog = posthogClient();

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
          guestUser: true,
        },
      },
      rounds: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  posthog.capture({ distinctId: user.userId, event: "get_games" });

  return games;
}

// Fetch a single game by ID
export async function getGameById(id: string) {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const game = await prisma.game.findUnique({
    where: {
      id: id,
    },
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
      rounds: {
        include: {
          scores: {
            include: {
              user: true,
              guestUser: true,
            },
          },
        },
      },
    },
  });

  return game;
}

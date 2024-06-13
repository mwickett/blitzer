import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import posthogClient from "@/app/posthog";

// Fetch all games that the current user is a part of
export async function getGames() {
  const user = auth();
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
        },
      },
      scores: true,
    },
  });

  posthog.capture({ distinctId: user.userId, event: "get_games" });

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
      username: true,
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

// Fetch players total rounds and rounds won
// This assumes that only one player blitzed per round (edge case)
// Maybe move this to some kind of computed property on the user model?
// https://www.prisma.io/docs/orm/prisma-client/queries/computed-fields
export async function getPlayerBattingAverage() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  // TODO: Figure out how to lookup with Clerk ID to avoid an extran DB call
  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const totalHandsPlayed = await prisma.score.count({
    where: {
      userId: prismaId.id,
    },
  });

  const totalHandsWon = await prisma.score.count({
    where: {
      userId: prismaId.id,
      blitzPileRemaining: 0,
    },
  });

  const rawBattingAverage =
    totalHandsPlayed === 0 ? 0 : totalHandsWon / totalHandsPlayed;

  const battingAverage = rawBattingAverage.toFixed(3);

  return {
    totalHandsPlayed,
    totalHandsWon,
    battingAverage,
  };
}

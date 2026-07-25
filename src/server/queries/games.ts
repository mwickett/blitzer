import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";

// One place owns the Game include trees. The query functions are annotated
// with the payload types these shapes produce, so include drift surfaces as
// a type error here instead of a partially-populated object at a renderer.

// List views: players resolved, rounds for counting (no per-round scores)
const gameSummaryInclude = {
  players: {
    include: {
      user: true,
      guestUser: true,
    },
  },
  rounds: true,
} satisfies Prisma.GameInclude;

// Single-game views: the full scores tree, rounds in play order
const gameDetailInclude = {
  players: {
    include: {
      user: true,
      guestUser: true,
    },
  },
  rounds: {
    include: {
      scores: true,
    },
    orderBy: {
      round: "asc",
    },
  },
} satisfies Prisma.GameInclude;

export type GameSummary = Prisma.GameGetPayload<{
  include: typeof gameSummaryInclude;
}>;

export type GameDetail = Prisma.GameGetPayload<{
  include: typeof gameDetailInclude;
}>;

// Fetch all games in the active circle
export async function getGames(): Promise<GameSummary[]> {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  return prisma.game.findMany({
    where: {
      OR: [
        ...(user.orgId ? [{ kind: "CIRCLE" as const, organizationId: user.orgId }] : []),
        {
          kind: "PICKUP",
          players: { some: { user: { clerk_user_id: user.userId } } },
        },
      ],
    },
    include: gameSummaryInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Fetch games without an organizationId (pre-circle legacy games)
export async function getLegacyGames(): Promise<GameSummary[]> {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  return prisma.game.findMany({
    where: {
      kind: "LEGACY",
      players: {
        some: {
          user: {
            clerk_user_id: user.userId,
          },
        },
      },
    },
    include: gameSummaryInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Fetch a single game by ID (public — game pages are shareable by link;
// score entry is still gated to circle members at the page level)
export async function getGameById(id: string): Promise<GameDetail | null> {
  return prisma.game.findUnique({
    where: {
      id: id,
    },
    include: gameDetailInclude,
  });
}

import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { getGameListPageForViewer } from "./gameList";
import type { GameListSearchParams } from "@/lib/gameList";

// Detail consumers share this full shape; lists use a separate display DTO.

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

export type GameDetail = Prisma.GameGetPayload<{
  include: typeof gameDetailInclude;
}>;

// List queries return a bounded display DTO and filter choices.
export async function getGames(params: GameListSearchParams = {}) {
  const viewer = await auth();
  if (!viewer.userId) throw new Error("Unauthorized");
  return getGameListPageForViewer(
    { userId: viewer.userId, orgId: viewer.orgId },
    params,
  );
}

export async function getLegacyGames(params: GameListSearchParams = {}) {
  const viewer = await auth();
  if (!viewer.userId) throw new Error("Unauthorized");
  return getGameListPageForViewer({ userId: viewer.userId }, params, "legacy");
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

import "server-only";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";

const lobbyInclude = {
  host: { select: { id: true, username: true } },
  players: {
    orderBy: { id: "asc" as const },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          clerk_user_id: true,
          avatarUrl: true,
        },
      },
      guestUser: { select: { id: true, name: true } },
    },
  },
};

/**
 * Backs the public `/join/[token]` page, which anyone holding the link can
 * load without signing in. It only needs the host's name, the seat count, and
 * enough to tell whether the viewer is already in the game — so it deliberately
 * does not use `lobbyInclude`, which would pull every player's username, avatar
 * and guest name for a request that never renders them.
 */
export async function getPickupLobbyByToken(joinToken: string) {
  return prisma.game.findUnique({
    where: { joinToken },
    include: {
      host: { select: { username: true } },
      players: { select: { user: { select: { clerk_user_id: true } } } },
    },
  });
}

export async function getPickupLobbyForParticipant(gameId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: lobbyInclude,
  });
  if (!game || game.kind !== "PICKUP") return null;
  if (!game.players.some((player) => player.user?.clerk_user_id === userId))
    return null;
  return game;
}

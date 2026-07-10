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

export async function getPickupLobbyByToken(joinToken: string) {
  return prisma.game.findUnique({
    where: { joinToken },
    include: lobbyInclude,
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

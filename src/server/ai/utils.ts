import prisma from "@/server/db/db";
import {
  EMPTY_GAME_STATS,
  EMPTY_ROUND_STATS,
  getGameStatsForUser,
  getRoundStatsForUser,
} from "@/server/queries/playerStats";

export async function getUserStatistics(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true },
  });
  if (!user) return { games: { ...EMPTY_GAME_STATS }, rounds: { ...EMPTY_ROUND_STATS } };

  const [games, rounds] = await Promise.all([
    getGameStatsForUser(user.id),
    getRoundStatsForUser(user.id),
  ]);
  return { games, rounds };
}

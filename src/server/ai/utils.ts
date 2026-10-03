import prisma from "@/server/db/db";
import {
  EMPTY_GAME_STATS,
  EMPTY_ROUND_STATS,
  getGameStatsForUser,
  getRoundStatsForUser,
} from "@/server/queries/playerStats";
import { EMPTY_HIGHLIGHTS, getPlayerHighlightsForUser } from "@/server/queries/playerHighlights";

export async function getUserStatistics(clerkUserId: string) {
  const user = await prisma.user.findUnique({
    where: { clerk_user_id: clerkUserId },
    select: { id: true },
  });
  if (!user) {
    return { games: { ...EMPTY_GAME_STATS }, rounds: { ...EMPTY_ROUND_STATS }, highlights: EMPTY_HIGHLIGHTS };
  }

  const [games, rounds, highlights] = await Promise.all([
    getGameStatsForUser(user.id),
    getRoundStatsForUser(user.id),
    getPlayerHighlightsForUser(user.id),
  ]);
  return { games, rounds, highlights };
}

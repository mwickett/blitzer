import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";

/**
 * Get game summary for a user scoped to active org
 * @param userId The clerk user ID
 * @returns Basic game statistics
 */
export async function getUserGameSummary(userId: string) {
  const { orgId } = await auth();

  // Without an active org, return empty stats
  if (!orgId) {
    return {
      gamesCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerk_user_id: userId },
    select: { id: true },
  });

  if (!user) {
    return {
      gamesCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
    };
  }

  const games = await prisma.game.findMany({
    where: {
      organizationId: orgId,
      players: {
        some: {
          userId: user.id,
        },
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      rounds: {
        include: {
          scores: true,
        },
      },
    },
  });

  let winCount = 0;
  let lossCount = 0;

  for (const game of games) {
    if (!game.isFinished) continue;
    if (game.winnerId === user.id) {
      winCount++;
    } else {
      lossCount++;
    }
  }

  return {
    gamesCount: games.length,
    winCount,
    lossCount,
    winRate: games.length > 0 ? (winCount / games.length) * 100 : 0,
  };
}

/**
 * Get detailed user statistics for LLM context scoped to active org
 * @param userId The clerk user ID
 * @returns Detailed game statistics
 */
export async function getUserStats(userId: string) {
  const { orgId } = await auth();

  if (!orgId) {
    return {
      totalRounds: 0,
      totalBlitzes: 0,
      totalCardsPlayed: 0,
      avgCardsPlayed: 0,
      avgBlitzRemaining: 0,
      blitzPercentage: 0,
      highestScore: 0,
      lowestScore: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerk_user_id: userId },
    select: { id: true },
  });

  if (!user) {
    return {
      totalRounds: 0,
      totalBlitzes: 0,
      totalCardsPlayed: 0,
      avgCardsPlayed: 0,
      avgBlitzRemaining: 0,
      blitzPercentage: 0,
      highestScore: 0,
      lowestScore: 0,
    };
  }

  const scores = await prisma.score.findMany({
    where: {
      userId: user.id,
      round: {
        game: {
          organizationId: orgId,
        },
      },
    },
    include: {
      round: true,
    },
  });

  if (scores.length === 0) {
    return {
      totalRounds: 0,
      totalBlitzes: 0,
      totalCardsPlayed: 0,
      avgCardsPlayed: 0,
      avgBlitzRemaining: 0,
      blitzPercentage: 0,
      highestScore: 0,
      lowestScore: 0,
    };
  }

  let totalBlitzes = 0;
  let totalCardsPlayed = 0;
  let totalBlitzRemaining = 0;

  const calculatedScores = scores.map((score) => {
    return {
      ...score,
      calculatedScore: score.totalCardsPlayed - score.blitzPileRemaining * 2,
    };
  });

  let highestScore = Math.max(
    ...calculatedScores.map((s) => s.calculatedScore)
  );
  let lowestScore = Math.min(...calculatedScores.map((s) => s.calculatedScore));

  for (const score of scores) {
    totalCardsPlayed += score.totalCardsPlayed;
    totalBlitzRemaining += score.blitzPileRemaining;
    if (score.blitzPileRemaining === 0) {
      totalBlitzes++;
    }
  }

  const avgCardsPlayed =
    scores.length > 0 ? totalCardsPlayed / scores.length : 0;
  const avgBlitzRemaining =
    scores.length > 0 ? totalBlitzRemaining / scores.length : 0;
  const blitzPercentage =
    scores.length > 0 ? (totalBlitzes / scores.length) * 100 : 0;

  return {
    totalRounds: scores.length,
    totalBlitzes,
    totalCardsPlayed,
    avgCardsPlayed,
    avgBlitzRemaining,
    blitzPercentage,
    highestScore,
    lowestScore,
  };
}

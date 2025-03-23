import prisma from "@/server/db/db";

/**
 * Get game summary for a user
 * @param userId The clerk user ID
 * @returns Basic game statistics
 */
export async function getUserGameSummary(userId: string) {
  // Get user ID from clerk user ID
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

  // Get games where user is a player
  const games = await prisma.game.findMany({
    where: {
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

  // Calculate wins
  let winCount = 0;
  let lossCount = 0;

  for (const game of games) {
    // Only count completed games
    if (!game.isFinished) continue;

    // Check if this user is the winner
    if (game.winnerId === user.id) {
      winCount++;
    } else if (game.isFinished) {
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
 * Get detailed user statistics for LLM context
 * @param userId The clerk user ID
 * @returns Detailed game statistics
 */
export async function getUserStats(userId: string) {
  // Get user ID from clerk user ID
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

  // Get all scores for this user
  const scores = await prisma.score.findMany({
    where: {
      userId: user.id,
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

  // Calculate statistics
  let totalBlitzes = 0;
  let totalCardsPlayed = 0;
  let totalBlitzRemaining = 0;

  // Calculate total score for each record (totalCardsPlayed - (blitzPileRemaining * 2))
  const calculatedScores = scores.map((score) => {
    return {
      ...score,
      calculatedScore: score.totalCardsPlayed - score.blitzPileRemaining * 2,
    };
  });

  // Find highest and lowest scores
  let highestScore = Math.max(
    ...calculatedScores.map((s) => s.calculatedScore)
  );
  let lowestScore = Math.min(...calculatedScores.map((s) => s.calculatedScore));

  for (const score of scores) {
    totalCardsPlayed += score.totalCardsPlayed;
    totalBlitzRemaining += score.blitzPileRemaining;

    // Count blitzes (when blitz pile is empty)
    if (score.blitzPileRemaining === 0) {
      totalBlitzes++;
    }
  }

  // Calculate averages
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

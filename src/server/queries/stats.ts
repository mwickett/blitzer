import "server-only";

import { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";

// Batting average
// Fetch players total rounds and rounds won
// This assumes that only one player blitzed per round (edge case)
// Maybe move this to some kind of computed property on the user model?
// https://www.prisma.io/docs/orm/prisma-client/queries/computed-fields
export async function getPlayerBattingAverage() {
  const id = await getUserIdFromAuth();

  const totalHandsPlayed = await prisma.score.count({
    where: {
      userId: id,
    },
  });

  const totalHandsWon = await prisma.score.count({
    where: {
      userId: id,
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

// Highest / lowest score
export async function getHighestAndLowestScore() {
  const id = await getUserIdFromAuth();

  const scores = await prisma.$queryRaw<
    Array<{
      score: number;
      totalCardsPlayed: number;
      blitzPileRemaining: number;
    }>
  >(
    Prisma.sql`
      SELECT
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) as score,
        "totalCardsPlayed",
        "blitzPileRemaining"
      FROM "Score"
      WHERE "userId" = ${id}
      AND (
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
          SELECT MAX("totalCardsPlayed" - ("blitzPileRemaining" * 2))
          FROM "Score"
          WHERE "userId" = ${id}
        )
        OR
        ("totalCardsPlayed" - ("blitzPileRemaining" * 2)) = (
          SELECT MIN("totalCardsPlayed" - ("blitzPileRemaining" * 2))
          FROM "Score"
          WHERE "userId" = ${id}
        )
      )
    `
  );

  const highestScore = scores.reduce(
    (max, score) => (max.score > score.score ? max : score),
    scores[0]
  );
  const lowestScore = scores.reduce(
    (min, score) => (min.score < score.score ? min : score),
    scores[0]
  );

  if (!highestScore) {
    return { highest: null, lowest: null };
  }

  const createScoreObject = (score: typeof highestScore) => ({
    score: score.score,
    totalCardsPlayed: score.totalCardsPlayed,
    blitzPileRemaining: score.blitzPileRemaining,
  });

  const highest = createScoreObject(highestScore);

  if (!lowestScore || lowestScore === highestScore) {
    return { highest, lowest: null };
  }

  const lowest = createScoreObject(lowestScore);

  return { highest, lowest };
}

// Cumulative score
export async function getCumulativeScore() {
  const id = await getUserIdFromAuth();

  const cumulativeScore = await prisma.score.aggregate({
    where: {
      userId: id,
    },
    _sum: {
      totalCardsPlayed: true,
      blitzPileRemaining: true,
    },
  });

  const totalCardsPlayed = cumulativeScore._sum.totalCardsPlayed;
  const blitzPileRemaining = cumulativeScore._sum.blitzPileRemaining;

  if (totalCardsPlayed === null || blitzPileRemaining === null) {
    return 0;
  }

  const totalScore = totalCardsPlayed - blitzPileRemaining * 2;

  return totalScore;
}

export async function getLongestAndShortestGamesByRounds() {
  const id = await getUserIdFromAuth();

  const games = await prisma.game.findMany({
    where: {
      players: {
        some: {
          userId: id,
        },
      },
      isFinished: true, // Only include completed games
    },
    include: {
      rounds: true,
    },
  });

  if (!games.length) {
    return { longest: null, shortest: null };
  }

  const gamesWithRoundCount = games.map((game) => ({
    id: game.id,
    roundCount: game.rounds.length,
    isFinished: game.isFinished,
  }));

  const longestGame = gamesWithRoundCount.reduce(
    (longest, current) =>
      current.roundCount > longest.roundCount ? current : longest,
    gamesWithRoundCount[0]
  );

  const gamesWithRounds = gamesWithRoundCount.filter(game => game.roundCount > 0);

  if (!gamesWithRounds.length) {
    return { longest: longestGame, shortest: null };
  }

  const shortestGame = gamesWithRounds.reduce(
    (shortest, current) =>
      current.roundCount < shortest.roundCount ? current : shortest,
    gamesWithRounds[0]
  );

  return { longest: longestGame, shortest: shortestGame };
}

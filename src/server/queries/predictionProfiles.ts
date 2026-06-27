import "server-only";

import { auth } from "@clerk/nextjs/server";
import { type Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { calculateRoundScore } from "@/lib/validation/gameRules";

export const HISTORY_SAMPLE_LIMIT_PER_PLAYER = 120;
export const RECENT_DELTA_LIMIT = 40;

export interface PredictionScoreSample {
  userId: string | null;
  guestId: string | null;
  totalCardsPlayed: number;
  blitzPileRemaining: number;
}

export interface PredictionProfile {
  playerId: string;
  roundsPlayed: number;
  meanDelta: number;
  stdDelta: number;
  blitzRate: number;
  meanCardsPlayed: number;
  meanBlitzPileRemaining: number;
  recentDeltas: number[];
}

export type PredictionProfilesByPlayer = Record<string, PredictionProfile>;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function getSamplePlayerId(sample: PredictionScoreSample): string | null {
  return sample.userId ?? sample.guestId ?? null;
}

export function buildPredictionProfiles(
  playerIds: string[],
  samples: PredictionScoreSample[]
): PredictionProfilesByPlayer {
  const samplesByPlayer = new Map<string, PredictionScoreSample[]>();

  for (const playerId of playerIds) {
    samplesByPlayer.set(playerId, []);
  }

  for (const sample of samples) {
    const playerId = getSamplePlayerId(sample);
    if (!playerId || !samplesByPlayer.has(playerId)) continue;
    samplesByPlayer.get(playerId)?.push(sample);
  }

  return Object.fromEntries(
    [...samplesByPlayer.entries()]
      .filter(([, playerSamples]) => playerSamples.length > 0)
      .map(([playerId, playerSamples]) => {
        const deltas = playerSamples.map(calculateRoundScore);
        const deltaMean = mean(deltas);

        return [
          playerId,
          {
            playerId,
            roundsPlayed: playerSamples.length,
            meanDelta: deltaMean,
            stdDelta: stddev(deltas, deltaMean),
            blitzRate:
              playerSamples.filter((sample) => sample.blitzPileRemaining === 0)
                .length / playerSamples.length,
            meanCardsPlayed: mean(
              playerSamples.map((sample) => sample.totalCardsPlayed)
            ),
            meanBlitzPileRemaining: mean(
              playerSamples.map((sample) => sample.blitzPileRemaining)
            ),
            recentDeltas: deltas.slice(0, RECENT_DELTA_LIMIT),
          },
        ];
      })
  );
}

export async function getPredictionProfilesForGame(
  gameId: string
): Promise<PredictionProfilesByPlayer> {
  const [session, game] = await Promise.all([
    auth(),
    prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        organizationId: true,
        players: {
          select: {
            userId: true,
            guestId: true,
          },
        },
      },
    }),
  ]);

  // Forecast history is optional enrichment: return no profiles instead of
  // throwing so public/spectator game pages can keep rendering safely.
  if (!session.userId || !session.orgId || !game?.organizationId) {
    return {};
  }

  if (game.organizationId !== session.orgId) {
    return {};
  }

  const userIds = game.players
    .map((player) => player.userId)
    .filter((id): id is string => Boolean(id));
  const guestIds = game.players
    .map((player) => player.guestId)
    .filter((id): id is string => Boolean(id));
  const playerIds = [...userIds, ...guestIds];

  if (playerIds.length === 0) {
    return {};
  }

  const historyScope = {
    round: {
      // Deliberately exclude this game; live in-game rounds are supplied by
      // the scoring UI and will be blended separately by the forecast model.
      gameId: { not: gameId },
      game: {
        organizationId: game.organizationId,
        isFinished: true,
      },
    },
  };

  const scoreSelect = {
    userId: true,
    guestId: true,
    totalCardsPlayed: true,
    blitzPileRemaining: true,
  } as const;
  const scoreOrder: Prisma.ScoreOrderByWithRelationInput[] = [
    { createdAt: "desc" },
    { id: "desc" },
  ];

  const samplesByPlayer = await Promise.all([
    ...userIds.map((userId) =>
      prisma.score.findMany({
        where: {
          userId,
          ...historyScope,
        },
        select: scoreSelect,
        orderBy: scoreOrder,
        take: HISTORY_SAMPLE_LIMIT_PER_PLAYER,
      })
    ),
    ...guestIds.map((guestId) =>
      prisma.score.findMany({
        where: {
          guestId,
          ...historyScope,
        },
        select: scoreSelect,
        orderBy: scoreOrder,
        take: HISTORY_SAMPLE_LIMIT_PER_PLAYER,
      })
    ),
  ]);

  const samples = samplesByPlayer.flat();

  return buildPredictionProfiles(playerIds, samples);
}

import "server-only";

import { type Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { calculateRoundScore } from "@/lib/validation/gameRules";
import {
  type PredictionProfile,
  type PredictionProfilesByPlayer,
} from "@/lib/scoring/probability";

export type { PredictionProfile, PredictionProfilesByPlayer };

export const HISTORY_SAMPLE_LIMIT_PER_PLAYER = 120;
export const RECENT_DELTA_LIMIT = 40;

export interface PredictionScoreSample {
  userId: string | null;
  guestId: string | null;
  totalCardsPlayed: number;
  blitzPileRemaining: number;
}

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
  samples: PredictionScoreSample[],
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
              playerSamples.map((sample) => sample.totalCardsPlayed),
            ),
            meanBlitzPileRemaining: mean(
              playerSamples.map((sample) => sample.blitzPileRemaining),
            ),
            recentDeltas: deltas.slice(0, RECENT_DELTA_LIMIT),
          },
        ];
      }),
  );
}

interface PredictionGame {
  id: string;
  organizationId: string | null;
  players: { userId?: string | null; guestId?: string | null }[];
}

// This is server-only query code; the page supplies its already authenticated
// viewer and loaded game, avoiding a second auth call and game query.
export async function getPredictionProfilesForGame(
  game: PredictionGame | null,
  session: { userId: string | null; orgId?: string | null },
): Promise<PredictionProfilesByPlayer> {
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
      gameId: { not: game.id },
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

  try {
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
        }),
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
        }),
      ),
    ]);

    const samples = samplesByPlayer.flat();

    return buildPredictionProfiles(playerIds, samples);
  } catch {
    // Optional enrichment must never turn a score page into an error page.
    return {};
  }
}

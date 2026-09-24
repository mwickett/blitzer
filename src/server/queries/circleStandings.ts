import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";
import { requireAuthContext } from "../mutations/common";

type Db = Pick<PrismaClient, "$queryRaw">;

export type CircleStandingRow = {
  playerId: string;
  playerKind: "user" | "guest";
  displayName: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  winCount: number;
  lossCount: number;
  decidedGames: number;
  winRate: number;
  totalRounds: number;
  totalBlitzes: number;
  battingAverage: string;
  cumulativeScore: number;
};

export type CircleHeadToHeadRow = {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  gamesPlayed: number;
  aWins: number;
  bWins: number;
};

export type CircleStandings = {
  organizationId: string;
  standings: CircleStandingRow[];
  headToHead: CircleHeadToHeadRow[];
};

type GameAggRow = {
  playerId: string;
  playerKind: string;
  displayName: string | null;
  avatarUrl: string | null;
  gamesPlayed: bigint | number;
  winCount: bigint | number;
  lossCount: bigint | number;
};

type RoundAggRow = {
  playerId: string;
  totalRounds: bigint | number;
  totalBlitzes: bigint | number;
  cumulativeScore: bigint | number | null;
};

type H2HRow = {
  playerAId: string;
  playerAName: string | null;
  playerBId: string;
  playerBName: string | null;
  gamesPlayed: bigint | number;
  aWins: bigint | number;
  bWins: bigint | number;
};

function battingAverage(totalRounds: number, totalBlitzes: number): string {
  if (!totalRounds) return "0.000";
  return (totalBlitzes / totalRounds).toFixed(3);
}

function sortStandings(a: CircleStandingRow, b: CircleStandingRow): number {
  // Prefer players with decided games, then win rate, then wins, then games played.
  if (a.decidedGames === 0 && b.decidedGames > 0) return 1;
  if (b.decidedGames === 0 && a.decidedGames > 0) return -1;
  if (b.winRate !== a.winRate) return b.winRate - a.winRate;
  if (b.winCount !== a.winCount) return b.winCount - a.winCount;
  if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  return a.displayName.localeCompare(b.displayName);
}

/**
 * All-time standings for CIRCLE games in one organization.
 * Pickup and legacy games are excluded. Guests who played in those games
 * appear under their guest id so regular guest seats are not silently omitted.
 */
export async function getCircleStandingsForOrg(
  organizationId: string,
  db: Db = prisma,
): Promise<CircleStandings> {
  const [gameRows, roundRows, h2hRows] = await Promise.all([
    db.$queryRaw<GameAggRow[]>(Prisma.sql`
      SELECT
        COALESCE(p."userId", p."guestId") AS "playerId",
        CASE WHEN p."userId" IS NOT NULL THEN 'user' ELSE 'guest' END AS "playerKind",
        COALESCE(u.username, gu.name) AS "displayName",
        u."avatarUrl" AS "avatarUrl",
        COUNT(*) FILTER (WHERE g.started_at IS NOT NULL) AS "gamesPlayed",
        COUNT(*) FILTER (
          WHERE g.started_at IS NOT NULL
            AND g.is_finished
            AND g."winnerId" = COALESCE(p."userId", p."guestId")
        ) AS "winCount",
        COUNT(*) FILTER (
          WHERE g.started_at IS NOT NULL
            AND g.is_finished
            AND g."winnerId" IS NOT NULL
            AND g."winnerId" != COALESCE(p."userId", p."guestId")
        ) AS "lossCount"
      FROM "GamePlayers" p
      INNER JOIN "Game" g ON g.id = p."gameId"
      LEFT JOIN "User" u ON u.id = p."userId"
      LEFT JOIN "GuestUser" gu ON gu.id = p."guestId"
      WHERE g.kind = 'CIRCLE'
        AND g.organization_id = ${organizationId}
        AND COALESCE(p."userId", p."guestId") IS NOT NULL
      GROUP BY
        COALESCE(p."userId", p."guestId"),
        CASE WHEN p."userId" IS NOT NULL THEN 'user' ELSE 'guest' END,
        COALESCE(u.username, gu.name),
        u."avatarUrl"
    `),
    db.$queryRaw<RoundAggRow[]>(Prisma.sql`
      SELECT
        COALESCE(s."userId", s."guestId") AS "playerId",
        COUNT(*) AS "totalRounds",
        COUNT(*) FILTER (WHERE s."blitzPileRemaining" = 0) AS "totalBlitzes",
        SUM(${Prisma.raw(ROUND_SCORE_SQL)}) AS "cumulativeScore"
      FROM "Score" s
      INNER JOIN "Round" r ON r.id = s."roundId"
      INNER JOIN "Game" g ON g.id = r."gameId"
      WHERE g.kind = 'CIRCLE'
        AND g.organization_id = ${organizationId}
        AND COALESCE(s."userId", s."guestId") IS NOT NULL
      GROUP BY COALESCE(s."userId", s."guestId")
    `),
    db.$queryRaw<H2HRow[]>(Prisma.sql`
      WITH finished AS (
        SELECT g.id, g."winnerId"
        FROM "Game" g
        WHERE g.kind = 'CIRCLE'
          AND g.organization_id = ${organizationId}
          AND g.started_at IS NOT NULL
          AND g.is_finished
          AND g."winnerId" IS NOT NULL
      ),
      named_players AS (
        SELECT
          p."gameId",
          COALESCE(p."userId", p."guestId") AS "playerId",
          COALESCE(u.username, gu.name) AS "displayName"
        FROM "GamePlayers" p
        LEFT JOIN "User" u ON u.id = p."userId"
        LEFT JOIN "GuestUser" gu ON gu.id = p."guestId"
        WHERE COALESCE(p."userId", p."guestId") IS NOT NULL
      ),
      pairs AS (
        SELECT
          LEAST(a."playerId", b."playerId") AS "playerAId",
          GREATEST(a."playerId", b."playerId") AS "playerBId",
          CASE
            WHEN a."playerId" < b."playerId" THEN a."displayName"
            ELSE b."displayName"
          END AS "playerAName",
          CASE
            WHEN a."playerId" < b."playerId" THEN b."displayName"
            ELSE a."displayName"
          END AS "playerBName",
          f."winnerId"
        FROM finished f
        INNER JOIN named_players a ON a."gameId" = f.id
        INNER JOIN named_players b
          ON b."gameId" = f.id
          AND a."playerId" < b."playerId"
      )
      SELECT
        "playerAId",
        MAX("playerAName") AS "playerAName",
        "playerBId",
        MAX("playerBName") AS "playerBName",
        COUNT(*) AS "gamesPlayed",
        COUNT(*) FILTER (WHERE "winnerId" = "playerAId") AS "aWins",
        COUNT(*) FILTER (WHERE "winnerId" = "playerBId") AS "bWins"
      FROM pairs
      GROUP BY "playerAId", "playerBId"
      ORDER BY COUNT(*) DESC, "playerAId", "playerBId"
    `),
  ]);

  const roundsByPlayer = new Map(
    roundRows.map((row) => [
      row.playerId,
      {
        totalRounds: Number(row.totalRounds ?? 0),
        totalBlitzes: Number(row.totalBlitzes ?? 0),
        cumulativeScore: Number(row.cumulativeScore ?? 0),
      },
    ]),
  );

  const standings = gameRows
    .map((row): CircleStandingRow => {
      const gamesPlayed = Number(row.gamesPlayed ?? 0);
      const winCount = Number(row.winCount ?? 0);
      const lossCount = Number(row.lossCount ?? 0);
      const decidedGames = winCount + lossCount;
      const rounds = roundsByPlayer.get(row.playerId) ?? {
        totalRounds: 0,
        totalBlitzes: 0,
        cumulativeScore: 0,
      };
      return {
        playerId: row.playerId,
        playerKind: row.playerKind === "guest" ? "guest" : "user",
        displayName: row.displayName ?? "Unknown player",
        avatarUrl: row.avatarUrl,
        gamesPlayed,
        winCount,
        lossCount,
        decidedGames,
        winRate: decidedGames ? (winCount / decidedGames) * 100 : 0,
        totalRounds: rounds.totalRounds,
        totalBlitzes: rounds.totalBlitzes,
        battingAverage: battingAverage(rounds.totalRounds, rounds.totalBlitzes),
        cumulativeScore: rounds.cumulativeScore,
      };
    })
    .filter((row) => row.gamesPlayed > 0)
    .sort(sortStandings);

  const headToHead: CircleHeadToHeadRow[] = h2hRows.map((row) => ({
    playerAId: row.playerAId,
    playerAName: row.playerAName ?? "Unknown player",
    playerBId: row.playerBId,
    playerBName: row.playerBName ?? "Unknown player",
    gamesPlayed: Number(row.gamesPlayed ?? 0),
    aWins: Number(row.aWins ?? 0),
    bWins: Number(row.bWins ?? 0),
  }));

  return { organizationId, standings, headToHead };
}

/** Active-circle standings for the signed-in member. */
export async function getCircleStandings(): Promise<CircleStandings> {
  const { orgId } = await requireAuthContext("org");
  return getCircleStandingsForOrg(orgId);
}

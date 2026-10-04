import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";
import { requireAuthContext } from "../mutations/common";

type Db = Pick<PrismaClient, "$queryRaw">;

export const CIRCLE_RECORD_KINDS = [
  "highestRound",
  "lowestRound",
  "mostBlitzes",
  "biggestComeback",
  "longestGame",
  "fastestWin",
] as const;

export type CircleRecordKind = (typeof CIRCLE_RECORD_KINDS)[number];

export type CircleRecord = {
  kind: CircleRecordKind;
  value: number;
  gameId: string;
  /** Null for game-wide records (longest game). */
  playerName: string | null;
  /** Round the record was set in, for single-round records. */
  roundNumber: number | null;
  at: Date;
};

type RecordRow = {
  kind: string;
  value: bigint | number;
  gameId: string;
  playerName: string | null;
  roundNumber: bigint | number | null;
  at: Date;
};

/**
 * All-time records for CIRCLE games in one organization. A record belongs to
 * the first game that set it; a later tie does not take it.
 */
export async function getCircleRecordsForOrg(
  organizationId: string,
  db: Db = prisma,
): Promise<CircleRecord[]> {
  const rows = await db.$queryRaw<RecordRow[]>(Prisma.sql`
    WITH games AS (
      SELECT
        g.id,
        g."winnerId",
        g.is_finished AS "isFinished",
        COALESCE(g.ended_at, g.started_at, g.created_at) AS "at"
      FROM "Game" g
      WHERE g.kind = 'CIRCLE'
        AND g.organization_id = ${organizationId}
        AND g.started_at IS NOT NULL
    ),
    scores AS (
      SELECT
        r."gameId",
        r.round,
        r.created_at AS "roundAt",
        COALESCE(s."userId", s."guestId") AS "playerId",
        ${Prisma.raw(ROUND_SCORE_SQL)} AS score,
        s."blitzPileRemaining" AS "blitzPile"
      FROM "Score" s
      INNER JOIN "Round" r ON r.id = s."roundId"
      INNER JOIN games g ON g.id = r."gameId"
      WHERE COALESCE(s."userId", s."guestId") IS NOT NULL
    ),
    finished AS (
      SELECT g.id, g."winnerId", g."at", COUNT(DISTINCT sc.round) AS rounds
      FROM games g
      INNER JOIN scores sc ON sc."gameId" = g.id
      WHERE g."isFinished" AND g."winnerId" IS NOT NULL
      GROUP BY g.id, g."winnerId", g."at"
    ),
    running AS (
      SELECT
        sc."gameId",
        sc.round,
        sc."playerId",
        SUM(sc.score) OVER (
          PARTITION BY sc."gameId", sc."playerId" ORDER BY sc.round
        ) AS total
      FROM scores sc
      INNER JOIN finished f ON f.id = sc."gameId"
    ),
    deficits AS (
      -- How far the eventual winner trailed the leader after each round
      -- before the last one.
      SELECT
        r."gameId",
        r."playerId",
        r.round,
        MAX(r.total) OVER (PARTITION BY r."gameId", r.round) - r.total AS deficit,
        f.rounds
      FROM running r
      INNER JOIN finished f ON f.id = r."gameId"
    ),
    candidates AS (
      (SELECT 'highestRound' AS kind, sc.score AS value, sc."gameId",
              sc."playerId", sc.round AS "roundNumber", sc."roundAt" AS "at"
       FROM scores sc
       ORDER BY sc.score DESC, sc."roundAt", sc."playerId"
       LIMIT 1)
      UNION ALL
      (SELECT 'lowestRound', sc.score, sc."gameId",
              sc."playerId", sc.round, sc."roundAt"
       FROM scores sc
       ORDER BY sc.score ASC, sc."roundAt", sc."playerId"
       LIMIT 1)
      UNION ALL
      (SELECT 'mostBlitzes', COUNT(*), sc."gameId", sc."playerId", NULL, f."at"
       FROM scores sc
       INNER JOIN finished f ON f.id = sc."gameId"
       WHERE sc."blitzPile" = 0
       GROUP BY sc."gameId", sc."playerId", f."at"
       ORDER BY COUNT(*) DESC, f."at", sc."playerId"
       LIMIT 1)
      UNION ALL
      (SELECT 'biggestComeback', MAX(d.deficit), d."gameId", d."playerId",
              NULL, f."at"
       FROM deficits d
       INNER JOIN finished f
         ON f.id = d."gameId" AND f."winnerId" = d."playerId"
       WHERE d.round < d.rounds
       GROUP BY d."gameId", d."playerId", f."at"
       HAVING MAX(d.deficit) > 0
       ORDER BY MAX(d.deficit) DESC, f."at"
       LIMIT 1)
      UNION ALL
      (SELECT 'longestGame', f.rounds, f.id, NULL, NULL, f."at"
       FROM finished f
       ORDER BY f.rounds DESC, f."at"
       LIMIT 1)
      UNION ALL
      (SELECT 'fastestWin', f.rounds, f.id, f."winnerId", NULL, f."at"
       FROM finished f
       ORDER BY f.rounds ASC, f."at"
       LIMIT 1)
    )
    SELECT
      c.kind,
      c.value,
      c."gameId",
      COALESCE(u.username, gu.name) AS "playerName",
      c."roundNumber",
      c."at"
    FROM candidates c
    LEFT JOIN "User" u ON u.id = c."playerId"
    LEFT JOIN "GuestUser" gu ON gu.id = c."playerId"
  `);

  const byKind = new Map(rows.map((row) => [row.kind, row]));
  return CIRCLE_RECORD_KINDS.flatMap((kind): CircleRecord[] => {
    const row = byKind.get(kind);
    if (!row) return [];
    return [
      {
        kind,
        value: Number(row.value),
        gameId: row.gameId,
        playerName:
          kind === "longestGame" ? null : (row.playerName ?? "Unknown player"),
        roundNumber: row.roundNumber == null ? null : Number(row.roundNumber),
        at: row.at,
      },
    ];
  });
}

/** Active-circle records for the signed-in member. */
export async function getCircleRecords(): Promise<CircleRecord[]> {
  const { orgId } = await requireAuthContext("org");
  return getCircleRecordsForOrg(orgId);
}

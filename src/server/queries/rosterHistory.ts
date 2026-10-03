import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";

type Db = Pick<PrismaClient, "$queryRaw">;

/** Recaps look back over this many earlier games played by the same table. */
export const ROSTER_HISTORY_LIMIT = 100;

export type RosterHistory = {
  /** Earlier completed games with a recorded winner where everyone at this table played. */
  gamesTogether: number;
  /** Wins keyed by participant id (userId ?? guestId); only players with a win appear. */
  winsByPlayer: Record<string, number>;
  /** Participant id of the most recent of those games' winner. */
  lastWinnerId: string | null;
};

export const EMPTY_ROSTER_HISTORY: RosterHistory = { gamesTogether: 0, winsByPlayer: {}, lastWinnerId: null };

/**
 * History of this exact group: earlier finished games that included every
 * participant now at the table (other people may also have played). Bounded
 * to the most recent games and aggregated in PostgreSQL.
 */
export async function getRosterHistory(
  gameId: string,
  participantIds: string[],
  db: Db = prisma,
): Promise<RosterHistory> {
  const ids = [...new Set(participantIds)];
  if (ids.length < 2) return EMPTY_ROSTER_HISTORY;

  const rows = await db.$queryRaw<Array<{ winnerId: string }>>(Prisma.sql`
    SELECT g."winnerId"
    FROM "Game" g
    JOIN "GamePlayers" p ON p."gameId" = g.id
    WHERE g.is_finished AND g.started_at IS NOT NULL AND g."winnerId" IS NOT NULL
      AND g.id <> ${gameId}
      AND COALESCE(p."userId", p."guestId") IN (${Prisma.join(ids)})
    GROUP BY g.id, g."winnerId", COALESCE(g.ended_at, g.created_at)
    HAVING COUNT(DISTINCT COALESCE(p."userId", p."guestId")) = ${ids.length}
    ORDER BY COALESCE(g.ended_at, g.created_at) DESC, g.id DESC
    LIMIT ${ROSTER_HISTORY_LIMIT}
  `);

  const winsByPlayer: Record<string, number> = {};
  for (const { winnerId } of rows) {
    if (ids.includes(winnerId)) winsByPlayer[winnerId] = (winsByPlayer[winnerId] ?? 0) + 1;
  }
  return { gamesTogether: rows.length, winsByPlayer, lastWinnerId: rows[0]?.winnerId ?? null };
}

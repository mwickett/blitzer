import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";
import {
  computeBadges,
  type BadgeGame,
  type BadgeProgress,
} from "@/lib/scoring/badges";

type Db = Pick<PrismaClient, "$queryRaw">;

/**
 * Badges are worked out from the player's latest finished games. Families
 * rarely pass this; beyond it, the oldest games stop counting.
 */
export const BADGE_GAMES_WINDOW = 300;

/** Round-by-round series for the user's latest finished games, any kind. */
export async function getBadgeGamesForUser(
  userId: string,
  db: Db = prisma,
  window = BADGE_GAMES_WINDOW,
): Promise<BadgeGame[]> {
  type Row = {
    gameId: string;
    finishedAt: Date;
    winnerId: string | null;
    winThreshold: number;
    playerId: string;
    playerName: string | null;
    roundNumber: number | null;
    delta: number | bigint | null;
    blitzPile: number | null;
  };
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH recent AS (
      SELECT g.id, g."winnerId", g.win_threshold,
             COALESCE(g.ended_at, g.created_at) AS finished_at
      FROM "Game" g
      WHERE g.started_at IS NOT NULL
        AND g.is_finished
        AND EXISTS (
          SELECT 1 FROM "GamePlayers" p
          WHERE p."gameId" = g.id AND p."userId" = ${userId}
        )
      ORDER BY finished_at DESC, g.id DESC
      LIMIT ${window}
    ),
    seats AS (
      SELECT
        recent.id AS "gameId",
        COALESCE(p."userId", p."guestId") AS "playerId",
        COALESCE(u.username, gu.name) AS "playerName"
      FROM recent
      INNER JOIN "GamePlayers" p ON p."gameId" = recent.id
      LEFT JOIN "User" u ON u.id = p."userId"
      LEFT JOIN "GuestUser" gu ON gu.id = p."guestId"
      WHERE COALESCE(p."userId", p."guestId") IS NOT NULL
    )
    SELECT
      seats."gameId",
      recent.finished_at AS "finishedAt",
      recent."winnerId",
      recent.win_threshold AS "winThreshold",
      seats."playerId",
      seats."playerName",
      r.round AS "roundNumber",
      ${Prisma.raw(ROUND_SCORE_SQL)} AS delta,
      s."blitzPileRemaining" AS "blitzPile"
    FROM seats
    INNER JOIN recent ON recent.id = seats."gameId"
    LEFT JOIN "Round" r ON r."gameId" = seats."gameId"
    LEFT JOIN "Score" s ON s."roundId" = r.id
      AND (s."userId" = seats."playerId" OR s."guestId" = seats."playerId")
    ORDER BY seats."gameId", seats."playerId", r.round
  `);

  const games = new Map<string, BadgeGame>();
  for (const row of rows) {
    let game = games.get(row.gameId);
    if (!game) {
      game = {
        gameId: row.gameId,
        finishedAt: new Date(row.finishedAt).toISOString(),
        winnerId: row.winnerId,
        winThreshold: Number(row.winThreshold),
        players: [],
        scoresByRound: {},
        deltasByRound: {},
        blitzByRound: {},
      };
      games.set(row.gameId, game);
    }
    const id = row.playerId;
    if (!game.scoresByRound[id]) {
      game.players.push({ id, name: row.playerName ?? "Unknown player" });
      game.scoresByRound[id] = [];
      game.deltasByRound[id] = [];
      game.blitzByRound[id] = [];
    }
    // A game without rounds still yields one row per seat, with no round.
    if (row.roundNumber === null) continue;
    // A seat with no score in a round adds 0, as on the game page.
    const delta = Number(row.delta ?? 0);
    const totals = game.scoresByRound[id];
    totals.push((totals.at(-1) ?? 0) + delta);
    game.deltasByRound[id].push(delta);
    game.blitzByRound[id].push(row.blitzPile);
  }
  return [...games.values()];
}

export async function getBadgesForUser(
  userId: string,
  db: Db = prisma,
): Promise<BadgeProgress[]> {
  return computeBadges(await getBadgeGamesForUser(userId, db), userId);
}

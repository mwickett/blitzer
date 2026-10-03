import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { LOBBY_MAX_AGE_MS } from "@/lib/lobbies";
import { ROUND_SCORE_SQL } from "@/lib/validation/gameRules";
import { isDeckId, type DeckId } from "@/lib/scoring/decks";

type Db = Pick<PrismaClient, "$queryRaw">;

export const EMPTY_GAME_STATS = {
  gamesCount: 0,
  inProgressGames: 0,
  completedGames: 0,
  endedGames: 0,
  waitingLobbies: 0,
  expiredLobbies: 0,
  winCount: 0,
  lossCount: 0,
  decidedGames: 0,
  winRate: 0,
};

export const EMPTY_ROUND_STATS = {
  totalRounds: 0,
  breakdownRounds: 0,
  totalBlitzes: 0,
  totalCardsPlayed: 0,
  avgCardsPlayed: 0,
  avgBlitzRemaining: 0,
  blitzPercentage: 0,
  highestScore: 0,
  lowestScore: 0,
  cumulativeScore: 0,
};

/** Played games have started. Win rate includes completed games with a winner. */
export async function getGameStatsForUser(
  userId: string,
  db: Db = prisma,
  now = new Date(),
) {
  const [row] = await db.$queryRaw<Array<Record<Exclude<keyof typeof EMPTY_GAME_STATS, "decidedGames" | "winRate">, bigint>>>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE started_at IS NOT NULL) AS "gamesCount",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND NOT is_finished AND ended_at IS NULL) AS "inProgressGames",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished) AS "completedGames",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND NOT is_finished AND ended_at IS NOT NULL) AS "endedGames",
      COUNT(*) FILTER (WHERE kind = 'PICKUP' AND started_at IS NULL AND NOT is_finished
        AND created_at >= ${new Date(now.getTime() - LOBBY_MAX_AGE_MS)}) AS "waitingLobbies",
      COUNT(*) FILTER (WHERE kind = 'PICKUP' AND started_at IS NULL AND NOT is_finished
        AND created_at < ${new Date(now.getTime() - LOBBY_MAX_AGE_MS)}) AS "expiredLobbies",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished AND "winnerId" = ${userId}) AS "winCount",
      COUNT(*) FILTER (WHERE started_at IS NOT NULL AND is_finished AND "winnerId" != ${userId}) AS "lossCount"
    FROM "Game" g
    WHERE EXISTS (SELECT 1 FROM "GamePlayers" p WHERE p."gameId" = g.id AND p."userId" = ${userId})
  `);
  const counts = {
    gamesCount: Number(row?.gamesCount ?? 0),
    inProgressGames: Number(row?.inProgressGames ?? 0),
    completedGames: Number(row?.completedGames ?? 0),
    endedGames: Number(row?.endedGames ?? 0),
    waitingLobbies: Number(row?.waitingLobbies ?? 0),
    expiredLobbies: Number(row?.expiredLobbies ?? 0),
    winCount: Number(row?.winCount ?? 0),
    lossCount: Number(row?.lossCount ?? 0),
  };
  const decidedGames = counts.winCount + counts.lossCount;
  return { ...counts, decidedGames, winRate: decidedGames ? counts.winCount / decidedGames * 100 : 0 };
}

/**
 * One aggregate row, independent of the length of a player's score history.
 * Rounds typed as totals ("Do math" mode) count toward rounds and scores, but
 * blitz and card stats cover only breakdownRounds: SQL aggregates skip nulls.
 */
export async function getRoundStatsForUser(userId: string, db: Db = prisma) {
  type Row = { [K in Exclude<keyof typeof EMPTY_ROUND_STATS, "blitzPercentage">]: number | bigint | null };
  const [row] = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT COUNT(*) AS "totalRounds",
      COUNT("blitzPileRemaining") AS "breakdownRounds",
      COUNT(*) FILTER (WHERE "blitzPileRemaining" = 0) AS "totalBlitzes",
      SUM("totalCardsPlayed") AS "totalCardsPlayed",
      AVG("totalCardsPlayed")::float8 AS "avgCardsPlayed",
      AVG("blitzPileRemaining")::float8 AS "avgBlitzRemaining",
      MAX(${Prisma.raw(ROUND_SCORE_SQL)}) AS "highestScore",
      MIN(${Prisma.raw(ROUND_SCORE_SQL)}) AS "lowestScore",
      SUM(${Prisma.raw(ROUND_SCORE_SQL)}) AS "cumulativeScore"
    FROM "Score"
    WHERE "userId" = ${userId}
  `);
  const totalRounds = Number(row?.totalRounds ?? 0);
  const breakdownRounds = Number(row?.breakdownRounds ?? 0);
  const totalBlitzes = Number(row?.totalBlitzes ?? 0);
  return {
    totalRounds,
    breakdownRounds,
    totalBlitzes,
    totalCardsPlayed: Number(row?.totalCardsPlayed ?? 0),
    avgCardsPlayed: Number(row?.avgCardsPlayed ?? 0),
    avgBlitzRemaining: Number(row?.avgBlitzRemaining ?? 0),
    blitzPercentage: breakdownRounds ? totalBlitzes / breakdownRounds * 100 : 0,
    highestScore: Number(row?.highestScore ?? 0),
    lowestScore: Number(row?.lowestScore ?? 0),
    cumulativeScore: Number(row?.cumulativeScore ?? 0),
  };
}

// Every completed game the user sat in, unordered. Played games have
// started; the winner may be a guest.
const userFinishedGames = (userId: string) => Prisma.sql`
  SELECT g.id, g."winnerId", COALESCE(g.ended_at, g.created_at) AS finished_at
  FROM "Game" g
  WHERE g.started_at IS NOT NULL
    AND g.is_finished
    AND EXISTS (
      SELECT 1 FROM "GamePlayers" p WHERE p."gameId" = g.id AND p."userId" = ${userId}
    )
`;

export type RecentGame = {
  id: string;
  /** ISO timestamp, so the DTO crosses the client boundary unchanged. */
  finishedAt: string;
  /** null when the game finished without a recorded winner. */
  won: boolean | null;
  score: number;
  place: number;
  playerCount: number;
  roundCount: number;
};

export type WinStreaks = {
  current: { kind: "win" | "loss"; length: number } | null;
  bestWin: number;
};

export type Rival = {
  playerId: string;
  kind: "user" | "guest";
  name: string;
  avatarUrl: string | null;
  gamesTogether: number;
  myWins: number;
  theirWins: number;
};

export const RECENT_GAMES_LIMIT = 10;
export const RIVALS_LIMIT = 3;

/** The user's latest completed games, newest first, with their final placing. */
export async function getRecentGamesForUser(
  userId: string,
  db: Db = prisma,
  limit = RECENT_GAMES_LIMIT,
): Promise<RecentGame[]> {
  type Row = {
    id: string;
    finishedAt: Date;
    winnerId: string | null;
    score: number | bigint;
    place: number | bigint;
    playerCount: number | bigint;
    roundCount: number | bigint;
  };
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH recent AS (
      ${userFinishedGames(userId)}
      ORDER BY finished_at DESC, g.id DESC
      LIMIT ${limit}
    ),
    totals AS (
      SELECT
        recent.id AS "gameId",
        COALESCE(p."userId", p."guestId") AS "playerId",
        COALESCE(SUM(${Prisma.raw(ROUND_SCORE_SQL)}), 0) AS total
      FROM recent
      INNER JOIN "GamePlayers" p ON p."gameId" = recent.id
      LEFT JOIN "Round" r ON r."gameId" = recent.id
      LEFT JOIN "Score" s ON s."roundId" = r.id
        AND (s."userId" = p."userId" OR s."guestId" = p."guestId")
      WHERE COALESCE(p."userId", p."guestId") IS NOT NULL
      GROUP BY recent.id, COALESCE(p."userId", p."guestId")
    )
    SELECT
      recent.id,
      recent.finished_at AS "finishedAt",
      recent."winnerId",
      me.total AS score,
      1 + (SELECT COUNT(*) FROM totals t WHERE t."gameId" = recent.id AND t.total > me.total) AS place,
      (SELECT COUNT(*) FROM totals t WHERE t."gameId" = recent.id) AS "playerCount",
      (SELECT COUNT(*) FROM "Round" r WHERE r."gameId" = recent.id) AS "roundCount"
    FROM recent
    INNER JOIN totals me ON me."gameId" = recent.id AND me."playerId" = ${userId}
    ORDER BY recent.finished_at DESC, recent.id DESC
  `);
  return rows.map((row) => ({
    id: row.id,
    finishedAt: new Date(row.finishedAt).toISOString(),
    won: row.winnerId === null ? null : row.winnerId === userId,
    score: Number(row.score),
    place: Number(row.place),
    playerCount: Number(row.playerCount),
    roundCount: Number(row.roundCount),
  }));
}

/** Current run and best winning run across decided games, as one aggregate row. */
export async function getWinStreaksForUser(
  userId: string,
  db: Db = prisma,
): Promise<WinStreaks> {
  type Row = {
    bestWin: number | bigint | null;
    currentWon: boolean | null;
    currentLength: number | bigint | null;
  };
  const [row] = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH ordered AS (
      SELECT
        finished."winnerId" = ${userId} AS won,
        ROW_NUMBER() OVER (ORDER BY finished.finished_at, finished.id) AS rn
      FROM (${userFinishedGames(userId)}) finished
      WHERE finished."winnerId" IS NOT NULL
    ),
    runs AS (
      SELECT won, COUNT(*) AS len, MAX(rn) AS last_rn
      FROM (
        SELECT won, rn, rn - ROW_NUMBER() OVER (PARTITION BY won ORDER BY rn) AS grp
        FROM ordered
      ) grouped
      GROUP BY won, grp
    ),
    latest AS (
      SELECT won, len FROM runs WHERE last_rn = (SELECT MAX(rn) FROM ordered)
    )
    SELECT
      (SELECT MAX(len) FROM runs WHERE won) AS "bestWin",
      (SELECT won FROM latest) AS "currentWon",
      (SELECT len FROM latest) AS "currentLength"
  `);
  const currentLength = Number(row?.currentLength ?? 0);
  return {
    current:
      currentLength && row?.currentWon !== null && row?.currentWon !== undefined
        ? { kind: row.currentWon ? "win" : "loss", length: currentLength }
        : null,
    bestWin: Number(row?.bestWin ?? 0),
  };
}

/** The people (or guests) the user has finished the most decided games with. */
export async function getRivalsForUser(
  userId: string,
  db: Db = prisma,
  limit = RIVALS_LIMIT,
): Promise<Rival[]> {
  type Row = {
    playerId: string;
    kind: string;
    name: string | null;
    avatarUrl: string | null;
    gamesTogether: number | bigint;
    myWins: number | bigint;
    theirWins: number | bigint;
  };
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    WITH decided AS (
      SELECT finished.id, finished."winnerId"
      FROM (${userFinishedGames(userId)}) finished
      WHERE finished."winnerId" IS NOT NULL
    )
    SELECT
      COALESCE(p."userId", p."guestId") AS "playerId",
      CASE WHEN p."userId" IS NOT NULL THEN 'user' ELSE 'guest' END AS kind,
      MAX(COALESCE(u.username, gu.name)) AS name,
      MAX(u."avatarUrl") AS "avatarUrl",
      COUNT(*) AS "gamesTogether",
      COUNT(*) FILTER (WHERE decided."winnerId" = ${userId}) AS "myWins",
      COUNT(*) FILTER (WHERE decided."winnerId" = COALESCE(p."userId", p."guestId")) AS "theirWins"
    FROM decided
    INNER JOIN "GamePlayers" p ON p."gameId" = decided.id
    LEFT JOIN "User" u ON u.id = p."userId"
    LEFT JOIN "GuestUser" gu ON gu.id = p."guestId"
    WHERE COALESCE(p."userId", p."guestId") IS NOT NULL
      AND (p."userId" IS NULL OR p."userId" != ${userId})
    GROUP BY COALESCE(p."userId", p."guestId"), CASE WHEN p."userId" IS NOT NULL THEN 'user' ELSE 'guest' END
    ORDER BY COUNT(*) DESC, COALESCE(p."userId", p."guestId")
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    playerId: row.playerId,
    kind: row.kind === "guest" ? "guest" : "user",
    name: row.name ?? "Unknown player",
    avatarUrl: row.avatarUrl,
    gamesTogether: Number(row.gamesTogether),
    myWins: Number(row.myWins),
    theirWins: Number(row.theirWins),
  }));
}

export type DeckStat = {
  deck: DeckId;
  games: number;
  wins: number;
  winRate: number;
};

/** Win rate per deck the user played, over completed games with a winner. */
export async function getDeckStatsForUser(
  userId: string,
  db: Db = prisma,
): Promise<DeckStat[]> {
  type Row = { deck: string; games: number | bigint; wins: number | bigint };
  const rows = await db.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      p.deck,
      COUNT(*) AS games,
      COUNT(*) FILTER (WHERE g."winnerId" = ${userId}) AS wins
    FROM "GamePlayers" p
    INNER JOIN "Game" g ON g.id = p."gameId"
    WHERE p."userId" = ${userId}
      AND p.deck IS NOT NULL
      AND g.started_at IS NOT NULL
      AND g.is_finished
      AND g."winnerId" IS NOT NULL
    GROUP BY p.deck
  `);
  return rows
    .filter((row): row is Row & { deck: DeckId } => isDeckId(row.deck))
    .map((row) => {
      const games = Number(row.games);
      const wins = Number(row.wins);
      return { deck: row.deck, games, wins, winRate: games ? (wins / games) * 100 : 0 };
    })
    .sort((a, b) => b.games - a.games || a.deck.localeCompare(b.deck));
}

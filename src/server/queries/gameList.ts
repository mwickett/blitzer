import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { isLobbyExpired, LOBBY_MAX_AGE_MS } from "@/lib/lobbies";
import {
  GAME_LIST_PAGE_SIZE,
  GAME_PLAYER_OPTION_LIMIT,
  parseGameListFilters,
  type GameListFilters,
  type GameListItem,
  type GameListPage,
  type GameListSearchParams,
} from "@/lib/gameList";

type Viewer = { userId: string; orgId?: string | null };
type Db = Pick<PrismaClient, "game" | "user" | "guestUser">;
type Scope = "current" | "legacy";

const gameListSelect = {
  id: true,
  kind: true,
  createdAt: true,
  startedAt: true,
  isFinished: true,
  endedAt: true,
  winnerId: true,
  _count: { select: { rounds: true } },
  players: {
    select: {
      userId: true,
      guestId: true,
      user: { select: { username: true } },
      guestUser: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.GameSelect;
type Row = Prisma.GameGetPayload<{ select: typeof gameListSelect }>;

function gameScope(viewer: Viewer, scope: Scope): Prisma.GameWhereInput {
  if (scope === "legacy")
    return {
      kind: "LEGACY",
      players: { some: { user: { clerk_user_id: viewer.userId } } },
    };
  return {
    OR: [
      ...(viewer.orgId
        ? [{ kind: "CIRCLE" as const, organizationId: viewer.orgId }]
        : []),
      {
        kind: "PICKUP",
        players: { some: { user: { clerk_user_id: viewer.userId } } },
      },
    ],
  };
}

function statusWhere(
  status: GameListFilters["status"],
  now: Date,
): Prisma.GameWhereInput {
  const cutoff = new Date(now.getTime() - LOBBY_MAX_AGE_MS);
  switch (status) {
    case "lobby":
      return {
        kind: "PICKUP",
        startedAt: null,
        isFinished: false,
        createdAt: { gte: cutoff },
      };
    case "expired":
      return {
        kind: "PICKUP",
        startedAt: null,
        isFinished: false,
        createdAt: { lt: cutoff },
      };
    case "completed":
      return { isFinished: true };
    case "active":
      return { startedAt: { not: null }, isFinished: false, endedAt: null };
    case "ended":
      return {
        startedAt: { not: null },
        isFinished: false,
        endedAt: { not: null },
      };
    default:
      return {};
  }
}

function readCursor(value?: string): { id: string; createdAt: Date } | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      id?: unknown;
      createdAt?: unknown;
    };
    if (
      typeof cursor.id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(cursor.id) ||
      typeof cursor.createdAt !== "string"
    )
      return null;
    const createdAt = new Date(cursor.createdAt);
    return Number.isFinite(createdAt.getTime())
      ? { id: cursor.id, createdAt }
      : null;
  } catch {
    return null;
  }
}

function toListItem(game: Row, now: Date): GameListItem {
  const players = game.players.map((player) => ({
    key: player.userId ? `user:${player.userId}` : `guest:${player.guestId}`,
    name: player.user?.username ?? player.guestUser?.name ?? "Unknown player",
  }));
  const winner = game.players.find(
    (player) =>
      player.userId === game.winnerId || player.guestId === game.winnerId,
  );
  const status = game.isFinished
    ? "completed"
    : game.kind === "PICKUP" && !game.startedAt
      ? isLobbyExpired(game.createdAt, now)
        ? "expired"
        : "lobby"
      : game.endedAt
        ? "ended"
        : "active";
  return {
    id: game.id,
    kind: game.kind,
    status,
    startedAt: game.startedAt?.toISOString() ?? null,
    roundCount: game._count.rounds,
    players,
    winnerName: game.winnerId
      ? (winner?.user?.username ?? winner?.guestUser?.name ?? null)
      : null,
  };
}

/** A page of visible games plus bounded player choices from the whole visible scope. */
export async function getGameListPageForViewer(
  viewer: Viewer,
  params: GameListSearchParams = {},
  scope: Scope = "current",
  db: Db = prisma,
  now = new Date(),
): Promise<GameListPage> {
  if (!viewer.userId) throw new Error("Unauthorized");
  const filters = parseGameListFilters(params);
  const access = gameScope(viewer, scope);
  const selectedUsers = filters.players
    .filter((key) => key.startsWith("user:"))
    .map((key) => key.slice(5));
  const selectedGuests = filters.players
    .filter((key) => key.startsWith("guest:"))
    .map((key) => key.slice(6));
  const where: Prisma.GameWhereInput = {
    AND: [
      access,
      ...(filters.players.length > 8 ? [{ id: { in: [] } }] : []),
      statusWhere(filters.status, now),
      ...selectedUsers.map((userId) => ({ players: { some: { userId } } })),
      ...selectedGuests.map((guestId) => ({ players: { some: { guestId } } })),
    ],
  };
  const cursor = readCursor(filters.cursor);
  if (!cursor) delete filters.cursor;
  const pageWhere: Prisma.GameWhereInput = cursor
    ? {
        AND: [
          where,
          {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          },
        ],
      }
    : where;
  const userWhere: Prisma.UserWhereInput = {
    games: { some: { game: access } },
  };
  const guestWhere: Prisma.GuestUserWhereInput = {
    games: { some: { game: access } },
  };

  const [
    rows,
    totalMatches,
    users,
    guests,
    selectedUserOptions,
    selectedGuestOptions,
    legacyCount,
  ] = await Promise.all([
    db.game.findMany({
      where: pageWhere,
      select: gameListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: GAME_LIST_PAGE_SIZE + 1,
    }),
    db.game.count({ where }),
    db.user.findMany({
      where: {
        ...userWhere,
        username: { contains: filters.search, mode: "insensitive" },
      },
      select: { id: true, username: true },
      orderBy: [{ username: "asc" }, { id: "asc" }],
      take: GAME_PLAYER_OPTION_LIMIT + 1,
    }),
    db.guestUser.findMany({
      where: {
        ...guestWhere,
        name: { contains: filters.search, mode: "insensitive" },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: GAME_PLAYER_OPTION_LIMIT + 1,
    }),
    selectedUsers.length
      ? db.user.findMany({
          where: { ...userWhere, id: { in: selectedUsers } },
          select: { id: true, username: true },
          take: 9,
        })
      : [],
    selectedGuests.length
      ? db.guestUser.findMany({
          where: { ...guestWhere, id: { in: selectedGuests } },
          select: { id: true, name: true },
          take: 9,
        })
      : [],
    scope === "current"
      ? db.game.count({ where: gameScope(viewer, "legacy") })
      : 0,
  ]);
  const options = [
    ...users.map((user) => ({ key: `user:${user.id}`, name: user.username })),
    ...guests.map((guest) => ({ key: `guest:${guest.id}`, name: guest.name })),
  ].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  const selectedOptions = [
    ...selectedUserOptions.map((user) => ({
      key: `user:${user.id}`,
      name: user.username,
    })),
    ...selectedGuestOptions.map((guest) => ({
      key: `guest:${guest.id}`,
      name: guest.name,
    })),
  ];
  const playerOptions = [
    ...new Map(
      [...selectedOptions, ...options.slice(0, GAME_PLAYER_OPTION_LIMIT)].map(
        (option) => [option.key, option],
      ),
    ).values(),
  ];
  const page = rows.slice(0, GAME_LIST_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    games: page.map((game) => toListItem(game, now)),
    totalMatches,
    filters,
    nextCursor:
      rows.length > GAME_LIST_PAGE_SIZE && last
        ? Buffer.from(
            JSON.stringify({
              id: last.id,
              createdAt: last.createdAt.toISOString(),
            }),
          ).toString("base64url")
        : null,
    playerOptions,
    hasMorePlayerOptions: options.length > GAME_PLAYER_OPTION_LIMIT,
    legacyCount,
  };
}

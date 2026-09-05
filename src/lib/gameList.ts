export const GAME_LIST_PAGE_SIZE = 20;
export const GAME_PLAYER_OPTION_LIMIT = 50;
export const GAME_STATUSES = [
  "all",
  "lobby",
  "expired",
  "completed",
  "active",
  "ended",
] as const;
export type GameStatusFilter = (typeof GAME_STATUSES)[number];
export type GameListSearchParams = Record<
  string,
  string | string[] | undefined
>;
export type GamePlayerOption = { key: string; name: string };
export type GameListFilters = {
  status: GameStatusFilter;
  players: string[];
  search: string;
  cursor?: string;
};
export type GameListItem = {
  id: string;
  kind: "CIRCLE" | "PICKUP" | "LEGACY";
  status: Exclude<GameStatusFilter, "all">;
  startedAt: string | null;
  roundCount: number;
  players: GamePlayerOption[];
  winnerName: string | null;
};
export type GameListPage = {
  games: GameListItem[];
  totalMatches: number;
  nextCursor: string | null;
  filters: GameListFilters;
  playerOptions: GamePlayerOption[];
  hasMorePlayerOptions: boolean;
  legacyCount: number;
};

export function parseGameListFilters(
  params: GameListSearchParams = {},
): GameListFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const status = first(params.status);
  const players = Array.isArray(params.player)
    ? params.player
    : params.player
      ? [params.player]
      : [];
  const cursor = first(params.cursor);
  return {
    status: GAME_STATUSES.includes(status as GameStatusFilter)
      ? (status as GameStatusFilter)
      : "all",
    players: [
      ...new Set(
        players.filter((key) =>
          /^(user|guest):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            key,
          ),
        ),
      ),
    ].slice(0, 9),
    search: (first(params.search) ?? "").trim().slice(0, 100),
    ...(cursor && cursor.length <= 512 ? { cursor } : {}),
  };
}

export function gameListHref(
  basePath: string,
  filters: GameListFilters,
  cursor?: string,
) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  for (const player of filters.players) params.append("player", player);
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

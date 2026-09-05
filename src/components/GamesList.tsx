import Link from "next/link";
import Form from "next/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gameListHref, type GameListPage } from "@/lib/gameList";

const statusLabels = {
  lobby: "Waiting in lobby",
  expired: "Expired lobby",
  completed: "Completed",
  active: "In progress",
  ended: "Ended without winner",
};

export default function GameList({
  page,
  legacy = false,
}: {
  page: GameListPage;
  legacy?: boolean;
}) {
  const basePath = legacy ? "/games/legacy" : "/games";
  const { games, filters, playerOptions } = page;
  const hasFilters =
    filters.status !== "all" || filters.players.length > 0 || !!filters.search;
  const firstPage = gameListHref(basePath, filters);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {legacy ? "Legacy games" : "Games"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing {games.length} of {page.totalMatches} matching{" "}
            {page.totalMatches === 1 ? "game" : "games"}.
          </p>
          {legacy && (
            <p className="mt-2 text-sm text-muted-foreground">
              Games from before Circles are read-only and still count toward
              your personal statistics.
            </p>
          )}
        </div>
        <Button asChild>
          <Link href={legacy ? "/games" : "/games/new"}>
            {legacy ? "Back to games" : "New game"}
          </Link>
        </Button>
      </div>

      <Form
        action={basePath}
        key={JSON.stringify(filters)}
        className="mb-6 space-y-4 rounded-lg border p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor="game-status"
          >
            Game status
            <select
              id="game-status"
              name="status"
              defaultValue={filters.status}
              className="h-10 rounded-md border bg-background px-3 font-normal"
            >
              <option value="all">All games</option>
              {Object.entries(statusLabels)
                .filter(
                  ([status]) =>
                    !legacy || (status !== "lobby" && status !== "expired"),
                )
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit">Apply filters</Button>
          {hasFilters && (
            <Button variant="ghost" asChild>
              <Link href={basePath}>Clear filters</Link>
            </Button>
          )}
        </div>
        <details open={filters.players.length > 0 || !!filters.search}>
          <summary className="cursor-pointer text-sm font-medium">
            Players
            {filters.players.length > 0
              ? ` (${filters.players.length} selected)`
              : ""}
          </summary>
          <fieldset className="mt-3 space-y-3">
            <legend className="sr-only">Filter by players</legend>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm" htmlFor="player-search">
                Find a player
                <input
                  id="player-search"
                  name="search"
                  type="search"
                  defaultValue={filters.search}
                  maxLength={100}
                  placeholder="Player name"
                  className="h-10 rounded-md border bg-background px-3"
                />
              </label>
              <Button type="submit" variant="outline">
                Search players
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose up to eight players. Matching games include every selected
              player. Choices come from all games you can view
              {legacy ? " in this legacy list" : " in this list"}.
            </p>
            {playerOptions.length > 0 ? (
              <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {playerOptions.map((player) => (
                  <label
                    key={player.key}
                    className="flex min-w-0 items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="player"
                      value={player.key}
                      defaultChecked={filters.players.includes(player.key)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="break-words">
                      {player.name}
                      {player.key.startsWith("guest:") ? " (guest)" : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No players match this search.
              </p>
            )}
            {page.hasMorePlayerOptions && (
              <p className="text-sm text-muted-foreground">
                More players are available. Search by name to find them.
              </p>
            )}
            {filters.players.length > 8 && (
              <p role="alert" className="text-sm text-destructive">
                Select at most eight players.
              </p>
            )}
          </fieldset>
        </details>
      </Form>

      {games.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No games match these filters.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Games">
          {games.map((game) => (
            <li
              key={game.id}
              className="grid gap-4 rounded-lg border p-4 md:grid-cols-[1fr_2fr_1fr_auto] md:items-center"
            >
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant={
                    game.status === "completed"
                      ? "success"
                      : game.status === "expired"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {statusLabels[game.status]}
                </Badge>
                {game.kind === "PICKUP" && game.startedAt && (
                  <Badge variant="outline">Pickup</Badge>
                )}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-1" aria-label="Players">
                  {game.players.map((player) => (
                    <Badge
                      key={player.key}
                      variant="outline"
                      className="max-w-full break-words"
                    >
                      {player.name}
                    </Badge>
                  ))}
                </div>
                {game.winnerName && (
                  <p className="text-sm">
                    Winner: <strong>{game.winnerName}</strong>
                  </p>
                )}
              </div>
              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="inline text-muted-foreground">Started: </dt>
                  <dd className="inline">
                    {game.startedAt ? (
                      <time dateTime={game.startedAt}>
                        {new Date(game.startedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                    ) : (
                      "Not started"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">Rounds: </dt>
                  <dd className="inline">{game.roundCount}</dd>
                </div>
              </dl>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/games/${game.id}${game.status === "lobby" ? "/lobby" : ""}`}
                >
                  View game
                  <span className="sr-only">
                    {" "}
                    with {game.players.map((player) => player.name).join(", ")}
                  </span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {(filters.cursor || page.nextCursor) && (
        <nav
          aria-label="Game pages"
          className="mt-6 flex items-center justify-between gap-3"
        >
          {filters.cursor ? (
            <Button variant="outline" asChild>
              <Link href={firstPage}>First page</Link>
            </Button>
          ) : (
            <span />
          )}
          {page.nextCursor && (
            <Button variant="outline" asChild>
              <Link href={gameListHref(basePath, filters, page.nextCursor)}>
                Next page
              </Link>
            </Button>
          )}
        </nav>
      )}
    </main>
  );
}

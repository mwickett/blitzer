"use client";

import { useState, useMemo } from "react";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Eye, Trophy, X } from "lucide-react";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  format,
  differenceInWeeks,
  isThisYear,
} from "date-fns";
import { Game, GamePlayers, User } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type GameWithPlayersAndUsers = Game & {
  players: (GamePlayers & {
    user?: User | null;
    guestUser?: { id: string; name: string } | null;
  })[];
  rounds: { id: string }[];
};

type GameStatusFilter = "all" | "completed" | "active" | "ended";

function GameList({ games }: { games: GameWithPlayersAndUsers[] }) {
  const router = useRouter();
  const { organization } = useOrganization();
  const circleName = organization?.name ?? "the active Circle";

  const [statusFilter, setStatusFilter] =
    useState<GameStatusFilter>("all");
  const [playerFilters, setPlayerFilters] = useState<string[]>([]);
  const [playerFilterOpen, setPlayerFilterOpen] = useState(false);

  const allPlayers = useMemo(() => {
    const playerMap = new Map<string, { id: string; username: string }>();

    games.forEach((game) =>
      game.players.forEach((player) => {
        if (player.user) {
          playerMap.set(player.user.id, {
            id: player.user.id,
            username: player.user.username,
          });
        } else if (player.guestUser) {
          playerMap.set(player.guestUser.id, {
            id: player.guestUser.id,
            username: player.guestUser.name,
          });
        }
      })
    );
    return Array.from(playerMap.values());
  }, [games]);

  const handleViewGame = (gameId: string) => {
    router.push(`/games/${gameId}`);
  };

  const formatGameDate = (date: Date) => {
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    if (isYesterday(date)) {
      return "Yesterday";
    }

    if (isThisWeek(date)) {
      return format(date, "EEEE"); // Returns the full day name
    }

    const weeksAgo = differenceInWeeks(new Date(), date);
    if (weeksAgo <= 4) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    if (isThisYear(date)) {
      return format(date, "MMM d"); // e.g. "Jul 15"
    }

    return format(date, "MMM d, yyyy"); // e.g. "Jul 15, 2023"
  };

  const getGameStatus = (game: GameWithPlayersAndUsers) => {
    if (game.isFinished) {
      return <Badge variant="success">Completed</Badge>;
    }
    if (game.endedAt) {
      return <Badge variant="destructive">Ended</Badge>;
    }
    return <Badge variant="default">Ongoing</Badge>;
  };

  const getWinnerName = (game: GameWithPlayersAndUsers) => {
    if (!game.winnerId) return null;
    const winner = game.players.find(
      (p) =>
        (p.user && p.user.id === game.winnerId) ||
        (p.guestUser && p.guestUser.id === game.winnerId)
    );

    if (!winner) return null;

    if (winner.user) {
      return winner.user.username;
    } else if (winner.guestUser) {
      return winner.guestUser.name;
    }

    return null;
  };

  const selectedPlayers = useMemo(
    () => allPlayers.filter((player) => playerFilters.includes(player.id)),
    [allPlayers, playerFilters]
  );

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "completed" && game.isFinished) ||
        (statusFilter === "active" && !game.isFinished && !game.endedAt) ||
        (statusFilter === "ended" && !game.isFinished && !!game.endedAt);

      const playerMatch =
        playerFilters.length === 0 ||
        playerFilters.every((playerId) =>
          game.players.some(
            (p) =>
              (p.user && p.user.id === playerId) ||
              (p.guestUser && p.guestUser.id === playerId)
          )
        );

      return statusMatch && playerMatch;
    });
  }, [statusFilter, playerFilters, games]);

  const hasActiveFilters = statusFilter !== "all" || playerFilters.length > 0;

  const togglePlayerFilter = (playerId: string) => {
    setPlayerFilters((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setPlayerFilters([]);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Games</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing {filteredGames.length} of {games.length}{" "}
            {games.length === 1 ? "game" : "games"} from {circleName}. Filters
            narrow this Circle-wide list.
          </p>
        </div>
        <Button asChild>
          <Link href="/games/new">New Game</Link>
        </Button>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as GameStatusFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Circle games</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="active">In progress</SelectItem>
              <SelectItem value="ended">Ended without winner</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Popover open={playerFilterOpen} onOpenChange={setPlayerFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-label="Filter by players"
                  aria-expanded={playerFilterOpen}
                  disabled={allPlayers.length === 0}
                  className="w-full justify-between sm:w-[260px]"
                >
                  {allPlayers.length === 0
                    ? "No players yet"
                    : playerFilters.length === 0
                      ? "Players: All"
                      : `Players: ${playerFilters.length} selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search players..." />
                  <CommandList>
                    <CommandEmpty>No players found.</CommandEmpty>
                    <CommandGroup>
                      {allPlayers.map((player) => {
                        const selected = playerFilters.includes(player.id);

                        return (
                          <CommandItem
                            key={player.id}
                            value={player.username}
                            onSelect={() => togglePlayerFilter(player.id)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span className="truncate">{player.username}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {playerFilters.length > 0 && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setPlayerFilters([])}
                    >
                      Clear player filter
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        </div>
        {selectedPlayers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedPlayers.map((player) => (
              <Badge key={player.id} variant="secondary" className="gap-1 pr-1">
                {player.username}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-background/60 focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={() => togglePlayerFilter(player.id)}
                  aria-label={`Remove ${player.username} filter`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedPlayers.length > 1 && (
              <p className="w-full text-sm text-muted-foreground">
                Matching games include every selected player.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Winner</TableHead>
              <TableHead>Players</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Rounds</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGames.map((game) => (
              <TableRow key={game.id}>
                <TableCell>{getGameStatus(game)}</TableCell>
                <TableCell>
                  {game.winnerId && (
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span>{getWinnerName(game)}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {game.players.map((player) => (
                      <Badge
                        key={player.userId || player.guestId}
                        variant="outline"
                        className="mr-1"
                      >
                        {player.user
                          ? player.user.username
                          : player.guestUser
                            ? player.guestUser.name
                            : "Unknown Player"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatGameDate(game.createdAt)}</TableCell>
                <TableCell>{game.rounds.length}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewGame(game.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-4">
        {filteredGames.map((game) => (
          <Card key={game.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>{getGameStatus(game)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatGameDate(game.createdAt)}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium mb-1">Players</div>
                  <div className="flex flex-wrap gap-1">
                    {game.players.map((player) => (
                      <Badge
                        key={player.userId || player.guestId}
                        variant="outline"
                        className="mr-1"
                      >
                        {player.user
                          ? player.user.username
                          : player.guestUser
                            ? player.guestUser.name
                            : "Unknown Player"}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Rounds</div>
                  <div>{game.rounds.length}</div>
                </div>
                {game.winnerId && (
                  <div>
                    <div className="text-sm font-medium mb-1">Winner</div>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span>{getWinnerName(game)}</span>
                    </div>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleViewGame(game.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Game
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {hasActiveFilters
            ? "No games found matching your filters"
            : `No games found in ${circleName}`}
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary and export
export default function GameListWithErrorBoundary(props: {
  games: GameWithPlayersAndUsers[];
}) {
  return (
    <ErrorBoundary
      componentName="GameList"
      context={{
        gamesCount: props.games.length,
        hasCompletedGames: props.games.some((game) => game.isFinished),
        section: "games-list",
      }}
    >
      <GameList {...props} />
    </ErrorBoundary>
  );
}

"use client";

import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Trophy } from "lucide-react";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
  format,
  differenceInWeeks,
  isThisYear,
} from "date-fns";
import { Game, GamePlayers, User } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

type GameWithPlayersAndUsers = Game & {
  players: (GamePlayers & {
    user: User;
  })[];
};

export default function GameList({
  games,
}: {
  games: GameWithPlayersAndUsers[];
}) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "ongoing"
  >("all");
  const [playerFilters, setPlayerFilters] = useState<string[]>([]);

  const allPlayers = useMemo(() => {
    const playerMap = new Map();

    games.forEach((game) =>
      game.players.forEach((player) =>
        playerMap.set(player.user.id, {
          id: player.user.id,
          username: player.user.username,
        })
      )
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
    const winner = game.players.find((p) => p.user.id === game.winnerId);
    return winner ? winner.user.username : null;
  };

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "completed" && game.isFinished) ||
        (statusFilter === "ongoing" && !game.isFinished);

      const playerMatch =
        playerFilters.length === 0 ||
        playerFilters.some((playerId) =>
          game.players.some((p) => p.user.id === playerId)
        );

      return statusMatch && playerMatch;
    });
  }, [statusFilter, playerFilters, games]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Games</h1>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | "completed" | "ongoing") =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {allPlayers.map((player) => (
              <label
                key={player.id}
                className="flex items-center space-x-2 bg-secondary/20 rounded-lg px-2 py-1"
              >
                <Checkbox
                  checked={playerFilters.includes(player.id)}
                  onCheckedChange={(checked) => {
                    setPlayerFilters((prev) =>
                      checked
                        ? [...prev, player.id]
                        : prev.filter((p) => p !== player.id)
                    );
                  }}
                />
                <span className="text-sm">{player.username}</span>
              </label>
            ))}
          </div>
        </div>
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
                        key={player.userId}
                        variant="outline"
                        className="mr-1"
                      >
                        {player.user.username}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatGameDate(game.createdAt)}</TableCell>
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
                        key={player.userId}
                        variant="outline"
                        className="mr-1"
                      >
                        {player.user.username}
                      </Badge>
                    ))}
                  </div>
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
          No games found matching your filters
        </div>
      )}
    </div>
  );
}

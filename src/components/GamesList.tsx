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
import { Eye } from "lucide-react";
import { formatDistanceToNow, isBefore, subWeeks } from "date-fns";
import { Game, GamePlayers } from "@prisma/client";
import { useRouter } from "next/navigation";

type GameWithPlayers = Game & { players: GamePlayers[] };

export default function GameList({ games }: { games: GameWithPlayers[] }) {
  const router = useRouter();

  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "ongoing"
  >("all");
  const [playerFilters, setPlayerFilters] = useState<string[]>([]);

  const allPlayers = useMemo(() => {
    const playerSet = new Set<string>();
    games.forEach((game) =>
      game.players.forEach((player) => playerSet.add(player.userId))
    );
    return Array.from(playerSet);
  }, [games]);

  const handleViewGame = (gameId: string) => {
    router.push(`/games/${gameId}`);
  };

  const formatGameDate = (date: Date) => {
    const oneWeekAgo = subWeeks(new Date(), 1);
    if (isBefore(date, oneWeekAgo)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    return date.toLocaleDateString();
  };

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "completed" && game.endedAt) ||
        (statusFilter === "ongoing" && !game.endedAt);

      const playerMatch =
        playerFilters.length === 0 ||
        playerFilters.some((player) =>
          game.players.some((p) => p.userId === player)
        );

      return statusMatch && playerMatch;
    });
  }, [statusFilter, playerFilters, games]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Game List</h1>

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
              <label key={player} className="flex items-center space-x-2">
                <Checkbox
                  checked={playerFilters.includes(player)}
                  onCheckedChange={(checked) => {
                    setPlayerFilters((prev) =>
                      checked
                        ? [...prev, player]
                        : prev.filter((p) => p !== player)
                    );
                  }}
                />
                <span>{player}</span>
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
              <TableHead>Actions</TableHead>
              <TableHead>Date Started</TableHead>
              <TableHead>Date Ended</TableHead>
              <TableHead>Players</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGames.map((game) => (
              <TableRow key={game.id}>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewGame(game.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </TableCell>
                <TableCell>{formatGameDate(game.createdAt)}</TableCell>
                <TableCell>
                  {game.endedAt ? formatGameDate(game.endedAt) : "Ongoing"}
                </TableCell>
                <TableCell>{game.players.join(", ")}</TableCell>
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
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="text-sm font-medium">Date Started:</div>
                <div>{formatGameDate(game.createdAt)}</div>
                <div className="text-sm font-medium">Date Ended:</div>
                <div>
                  {game.endedAt ? formatGameDate(game.endedAt) : "Ongoing"}
                </div>
                <div className="text-sm font-medium">Players:</div>
                <div>{game.players.join(", ")}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleViewGame(game.id)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Game
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { getLegacyGames } from "@/server/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function LegacyGamesPage() {
  const games = await getLegacyGames();

  return (
    <main className="container mx-auto p-4 max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Legacy Games</h1>
        <p className="text-muted-foreground">
          These games were played before Circles were introduced. They are
          read-only and still count toward your personal dashboard stats.
        </p>
      </div>

      {games.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No legacy games found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {games.length} legacy {games.length === 1 ? "game" : "games"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Rounds</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell>
                      <Link
                        href={`/games/${game.id}`}
                        className="text-primary hover:underline"
                      >
                        {new Date(game.createdAt).toLocaleDateString()}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {game.players.map((player) => (
                          <Badge key={player.id} variant="secondary">
                            {player.user?.username ?? player.guestUser?.name ?? "Unknown"}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{game.rounds.length}</TableCell>
                    <TableCell>
                      <Badge variant={game.isFinished ? "default" : "outline"}>
                        {game.isFinished ? "Completed" : "Unfinished"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 text-center">
        <Link href="/games" className="text-sm text-muted-foreground hover:underline">
          Back to Games
        </Link>
      </div>
    </main>
  );
}

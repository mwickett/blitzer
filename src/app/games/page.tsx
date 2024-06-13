import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

import { getGames } from "@/server/queries";

export default async function GamesList() {
  const games = await getGames();

  return (
    <section className="p-6">
      <Button>
        <Link href="/games/new">New game</Link>
      </Button>
      <Table>
        <TableHeader>
          <TableHead>Game ID</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Ended At</TableHead>
          <TableHead>Players</TableHead>
        </TableHeader>
        <TableBody>
          {games.map((game) => (
            <TableRow key={game.id}>
              <TableCell>
                <Link href={`/games/${game.id}`}>
                  <Button>View</Button>
                </Link>
              </TableCell>
              <TableCell>{new Date(game.createdAt).toLocaleString()}</TableCell>
              <TableCell>
                {game.endedAt
                  ? new Date(game.endedAt).toLocaleString()
                  : "Ongoing"}
              </TableCell>
              <TableCell>
                {game.players.map((player) => player.user.username).join(", ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

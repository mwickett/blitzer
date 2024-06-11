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
import { auth } from "@clerk/nextjs/server";

import posthogClient from "@/app/posthog";

export default async function GamesList() {
  const user = auth();
  const posthog = posthogClient();

  posthog.capture({
    distinctId: user.userId ?? "anonymous",
    event: "games_list_view",
  });

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
                {game.players.map((player) => player.user.email).join(", ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

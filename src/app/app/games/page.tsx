// components/GamesList.server.tsx
import { auth } from "@clerk/nextjs/server";
import prisma from "@/db";
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

export default async function GamesList() {
  const { userId } = auth();

  if (!userId) {
    return (
      <div>
        <h2>You must be logged in to view this page.</h2>
      </div>
    );
  }

  const games = await prisma.game.findMany({
    where: {
      players: {
        some: {
          user: {
            clerk_user_id: userId,
          },
        },
      },
    },
    include: {
      players: {
        include: {
          user: true,
        },
      },
      scores: true,
    },
  });

  return (
    <section className="mx-40 my-20">
      <Button>
        <Link href="/app/games/new">New game</Link>
      </Button>
      <Table>
        <TableHeader>
          <TableHead>Game ID</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead>Ended At</TableHead>
          <TableHead>Players</TableHead>
          <TableHead>Scores</TableHead>
        </TableHeader>
        <TableBody>
          {games.map((game) => (
            <TableRow key={game.id}>
              <TableCell>
                <Link href={`/app/games/${game.id}`}>
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
              <TableCell>
                {game.scores
                  .map(
                    (score) =>
                      `Player: ${score.userId}, Score: ${
                        score.totalCardsPlayed - score.blitzPileRemaining
                      }`
                  )
                  .join(", ")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

import { Suspense } from "react";
import prisma from "../../../../db";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function Games() {
  const { userId } = auth();
  let games;
  // TODO bail and error if no user found=
  if (userId) {
    games = await prisma.game.findMany({
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
    console.log(games);
    console.log(userId);
  }
  return (
    <section>
      <h2>This is the games page</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <pre>{JSON.stringify(games, null, 2)}</pre>

        <Table>
          <TableCaption>A list of games</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Players</TableHead>
              <TableHead className="text-right">Winner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games &&
              games.map((game) => (
                <TableRow key={game.id}>
                  <TableCell>{game.id}</TableCell>
                  <TableCell>{game.createdAt.toString()}</TableCell>
                  <TableCell>
                    {game.isFinished ? "Complete" : "In Progress"}
                  </TableCell>
                  <TableCell>
                    {game.players.map((player) => player.user.email).join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    {game.winner ? game.winner.email : "None"}{" "}
                  </TableCell>
                </TableRow>
              ))}
            <TableRow>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Suspense>
    </section>
  );
}

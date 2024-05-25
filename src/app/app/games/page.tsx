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
    <div>
      <h2>This is the games page</h2>
      <pre>{JSON.stringify(games, null, 2)}</pre>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>This is a row</TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

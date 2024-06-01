import { User } from "@prisma/client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { GameWithPlayersAndScores } from "./page";

export default function ScoreDisplay({
  game,
}: {
  game: GameWithPlayersAndScores;
}) {
  return (
    <div>
      <Table className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto my-10">
        <TableHeader>
          <TableRow>
            <TableHead>Round</TableHead>
            {game.players.map((player) => (
              <TableHead key={player.user.id} className="w-[100px]">
                {player.user.email}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {game.scores.map((score, i) => (
            <TableRow key={score.id}>
              <TableCell className="font-medium bg-slate-50">{i}</TableCell>
              <TableCell>{score.blitzPileRemaining}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>50</TableCell>
            <TableCell>50</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

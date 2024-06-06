import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DisplayScores } from "./page";

export default function ScoreDisplay({
  displayScores,
}: {
  displayScores: DisplayScores[];
}) {
  const numRounds = Math.max(
    ...displayScores.map((player) => player.scoresByRound.length)
  );

  return (
    <div>
      <Table className="bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 max-w-md mx-auto my-10">
        <TableHeader>
          <TableRow>
            <TableHead>Round</TableHead>
            {displayScores.map((player) => (
              <TableHead
                key={player.userId}
                className={`text-xs ${player.isWinner ? "bg-green-50" : ""}`}
              >
                {player.isWinner ? `⭐ ${player.email} ⭐` : player.email}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: numRounds }).map((_, roundIndex) => (
            <TableRow key={roundIndex}>
              <TableCell className="font-medium bg-slate-50">
                {roundIndex + 1}
              </TableCell>
              {displayScores.map((player) => (
                <TableCell key={player.userId}>
                  {player.scoresByRound[roundIndex]
                    ? player.scoresByRound[roundIndex].join(", ")
                    : "-"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            {displayScores.map((player) => (
              <TableCell
                className={player.isInLead ? "bg-green-100" : ""}
                key={player.userId}
              >
                {player.total}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

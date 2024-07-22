import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DisplayScores } from "@/lib/gameLogic";

export default function ScoreDisplay({
  displayScores,
  numRounds,
}: {
  displayScores: DisplayScores[];
  numRounds: number;
}) {
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
                {player.isWinner ? `⭐ ${player.username} ⭐` : player.username}
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
              {displayScores.map((player) => {
                const score = player.scoresByRound[roundIndex];
                return (
                  <TableCell key={player.userId}>
                    {Array.isArray(score) ? score.join(", ") : score ?? "-"}
                  </TableCell>
                );
              })}
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

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import UserAvatar from "@/components/UserAvatar";

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
          <TableRow className="text-xs">
            <TableHead>Round</TableHead>
            {displayScores.map((player) => (
              <TableHead
                key={player.userId}
                className={`text-xs ${player.isWinner ? "bg-green-50" : ""}`}
              >
                <div className="flex flex-col gap-2">
                  <UserAvatar
                    src={player.user.avatarUrl ?? ""}
                    username={player.user.username}
                  />
                  {player.isWinner
                    ? `⭐ ${player.username} ⭐`
                    : player.username}
                </div>
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

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type {
  CircleHeadToHeadRow,
  CircleStandingRow,
} from "@/server/queries/circleStandings";

function formatWinRate(winRate: number, decidedGames: number): string {
  if (!decidedGames) return "—";
  return `${winRate.toFixed(0)}%`;
}

export function CircleStandingsTable({
  standings,
}: {
  standings: CircleStandingRow[];
}) {
  if (standings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">No Circle games yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Start a Circle game with your crew and standings will show up here.
        </p>
        <Link
          href="/games/new?type=circle"
          className="mt-4 inline-block text-sm font-medium underline"
        >
          New Circle game
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="px-3 py-3 font-medium">#</th>
            <th className="px-3 py-3 font-medium">Player</th>
            <th className="px-3 py-3 font-medium text-right">W–L</th>
            <th className="px-3 py-3 font-medium text-right">Win %</th>
            <th className="px-3 py-3 font-medium text-right">Games</th>
            <th className="px-3 py-3 font-medium text-right">BA</th>
            <th className="px-3 py-3 font-medium text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, index) => (
            <tr key={row.playerId} className="border-b last:border-0">
              <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.displayName}</span>
                  {row.playerKind === "guest" && (
                    <Badge variant="secondary">Guest</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.totalRounds}{" "}
                  {row.totalRounds === 1 ? "round" : "rounds"} ·{" "}
                  {row.totalBlitzes} blitz
                  {row.totalBlitzes === 1 ? "" : "es"}
                </div>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.winCount}–{row.lossCount}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatWinRate(row.winRate, row.decidedGames)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.gamesPlayed}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.battingAverage}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {row.cumulativeScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CircleHeadToHeadList({
  pairs,
}: {
  pairs: CircleHeadToHeadRow[];
}) {
  if (pairs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Head-to-head</h2>
      <p className="text-sm text-muted-foreground">
        Completed Circle games where both players were in the roster. Ranked by
        shared games played.
      </p>
      <ul className="divide-y rounded-lg border">
        {pairs.map((pair) => (
          <li
            key={`${pair.playerAId}:${pair.playerBId}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium">{pair.playerAName}</span>
              <span className="text-muted-foreground"> vs </span>
              <span className="font-medium">{pair.playerBName}</span>
              <div className="text-xs text-muted-foreground">
                {pair.gamesPlayed}{" "}
                {pair.gamesPlayed === 1 ? "game" : "games"} together
              </div>
            </div>
            <div className="tabular-nums font-medium">
              {pair.aWins}–{pair.bWins}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

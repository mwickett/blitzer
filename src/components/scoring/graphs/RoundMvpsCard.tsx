import { type PlayerWithScore } from "../types";

interface RoundMvpsCardProps {
  players: PlayerWithScore[];
  deltasByRound: Record<string, number[]>; // playerId -> delta per round
  /** false marks a round with no saved score for that player. */
  scoredByRound?: Record<string, boolean[]>;
}

export interface RoundMvpSummary {
  /** Player ids with the top score in each round; ties share the round. */
  mvpsByRound: string[][];
  /** Rounds won (outright or shared) per player id. */
  winsByPlayer: Record<string, number>;
}

export function computeRoundMvps(
  players: PlayerWithScore[],
  deltasByRound: Record<string, number[]>,
  scoredByRound?: Record<string, boolean[]>,
): RoundMvpSummary {
  const roundCount = Math.max(
    0,
    ...players.map((p) => deltasByRound[p.id]?.length ?? 0),
  );
  const winsByPlayer: Record<string, number> = Object.fromEntries(
    players.map((p) => [p.id, 0]),
  );
  const mvpsByRound: string[][] = [];

  for (let round = 0; round < roundCount; round++) {
    let best = -Infinity;
    let mvps: string[] = [];
    for (const player of players) {
      const delta = deltasByRound[player.id]?.[round];
      // A player without a saved score did not "score zero" that round.
      // Typed round totals still count: the MVP is decided by score alone.
      if (delta === undefined || scoredByRound?.[player.id]?.[round] === false)
        continue;
      if (delta > best) {
        best = delta;
        mvps = [player.id];
      } else if (delta === best) {
        mvps.push(player.id);
      }
    }
    mvpsByRound.push(mvps);
    for (const id of mvps) winsByPlayer[id] += 1;
  }

  return { mvpsByRound, winsByPlayer };
}

export function RoundMvpsCard({
  players,
  deltasByRound,
  scoredByRound,
}: RoundMvpsCardProps) {
  const { mvpsByRound, winsByPlayer } = computeRoundMvps(
    players,
    deltasByRound,
    scoredByRound,
  );
  const byId = new Map(players.map((p) => [p.id, p]));
  const leaderboard = [...players]
    .filter((p) => winsByPlayer[p.id] > 0)
    .sort((a, b) => winsByPlayer[b.id] - winsByPlayer[a.id]);
  const topWins = leaderboard.length ? winsByPlayer[leaderboard[0].id] : 0;

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Round MVPs
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        Top scorer in each round
      </div>

      <ol className="flex flex-wrap gap-1.5 mb-3" aria-label="MVP by round">
        {mvpsByRound.map((ids, round) => {
          const names = ids.map((id) => byId.get(id)?.name ?? "").join(" & ");
          return (
            <li
              key={round}
              className="flex flex-col items-center gap-1 w-10"
              aria-label={`Round ${round + 1}: ${names}`}
            >
              <span className="text-[11px] text-[#8b5e3c] font-medium">
                R{round + 1}
              </span>
              <span className="flex h-7 items-center -space-x-1.5">
                {ids.map((id) => (
                  <span
                    key={id}
                    className="h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ backgroundColor: byId.get(id)?.color }}
                    aria-hidden="true"
                  >
                    {byId.get(id)?.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>

      <ul className="space-y-1.5">
        {leaderboard.map((player) => {
          const wins = winsByPlayer[player.id];
          return (
            <li
              key={player.id}
              className="flex items-center justify-between text-sm"
            >
              <span
                className="font-semibold truncate"
                style={{ color: player.color }}
              >
                {wins === topWins && (
                  <span aria-hidden="true" className="mr-1">
                    🏆
                  </span>
                )}
                {player.name}
              </span>
              <span className="tabular-nums text-[#290806] font-bold">
                {wins} {wins === 1 ? "round" : "rounds"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import { useMemo } from "react";
import { type PlayerWithScore } from "../types";
import {
  calcWinProbabilities,
  calcProjectedFinishRound,
} from "@/lib/scoring/probability";

interface WinProbabilityCardProps {
  players: PlayerWithScore[];
  roundsPlayed: number;
  winThreshold: number;
  deltasByPlayer?: Record<string, number[]>;
}

export function WinProbabilityCard({
  players,
  roundsPlayed,
  winThreshold,
  deltasByPlayer,
}: WinProbabilityCardProps) {
  const probabilities = useMemo(
    () =>
      calcWinProbabilities(
        players.map((p) => ({ id: p.id, score: p.score, roundsPlayed })),
        winThreshold,
        deltasByPlayer
      ),
    [players, roundsPlayed, winThreshold, deltasByPlayer]
  );

  const sorted = useMemo(
    () =>
      probabilities
        ? [...players].sort(
            (a, b) =>
              (probabilities[b.id] ?? 0) - (probabilities[a.id] ?? 0)
          )
        : players,
    [players, probabilities]
  );

  if (!probabilities) {
    return (
      <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
        <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
          Win Probability
        </div>
        <div className="text-[13px] md:text-xs text-[#8b5e3c]">
          Available after 3 rounds
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Win Probability
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        Simulated over {roundsPlayed} rounds of data
      </div>

      <div className="space-y-2">
        {sorted.map((player) => {
          const pct = probabilities[player.id] ?? 0;
          return (
            <div key={player.id} className="flex items-center gap-2">
              <div
                className="w-14 md:w-10 text-[13px] md:text-[11px] font-semibold text-right flex-shrink-0 truncate leading-tight"
                style={{ color: player.color }}
              >
                {player.name}
              </div>
              <div className="flex-1 h-7 md:h-6 bg-[#f0e6d2] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 text-[13px] md:text-[11px] font-bold text-white min-w-[34px] md:min-w-[28px] tabular-nums"
                  style={{
                    width: `${Math.max(pct, 8)}%`,
                    backgroundColor: player.color,
                  }}
                >
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Projected finish */}
      <div className="mt-3 pt-3 border-t border-[#f0e6d2]">
        <div className="text-xs md:text-[11px] font-semibold text-[#8b5e3c] mb-2">
          Projected finish
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 md:gap-3">
          {sorted
            .filter((p) => (probabilities[p.id] ?? 0) > 0)
            .map((player) => {
              const round = calcProjectedFinishRound(
                player.score,
                roundsPlayed,
                winThreshold
              );
              return (
                <div key={player.id} className="text-center">
                  <div
                    className="text-xl md:text-lg font-extrabold"
                    style={{ color: player.color }}
                  >
                    ~R{round === Infinity ? "∞" : round}
                  </div>
                  <div
                    className="text-[13px] md:text-[11px] text-[#8b5e3c] max-w-16 truncate"
                  >
                    {player.name}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="text-xs md:text-[11px] text-[#8b5e3c] text-center mt-2 italic">
        Monte Carlo simulation · accounts for pace &amp; variance
      </div>
    </div>
  );
}

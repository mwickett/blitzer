import { type PlayerWithScore } from "../types";
import {
  calcWinProbabilities,
  calcProjectedFinishRound,
} from "@/lib/scoring/probability";

interface WinProbabilityCardProps {
  players: PlayerWithScore[];
  roundsPlayed: number;
  winThreshold: number;
}

export function WinProbabilityCard({
  players,
  roundsPlayed,
  winThreshold,
}: WinProbabilityCardProps) {
  const probabilities = calcWinProbabilities(
    players.map((p) => ({ id: p.id, score: p.score, roundsPlayed })),
    winThreshold
  );

  if (!probabilities) {
    return (
      <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
        <div className="text-[11px] font-bold text-[#290806] mb-0.5">
          Win Probability
        </div>
        <div className="text-[9px] text-[#8b5e3c]">
          Available after 3 rounds
        </div>
      </div>
    );
  }

  const sorted = [...players].sort(
    (a, b) => (probabilities[b.id] ?? 0) - (probabilities[a.id] ?? 0)
  );

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-[11px] font-bold text-[#290806] mb-0.5">
        Win Probability
      </div>
      <div className="text-[9px] text-[#8b5e3c] mb-3">
        Based on scoring pace through {roundsPlayed} rounds
      </div>

      <div className="space-y-2">
        {sorted.map((player) => {
          const pct = probabilities[player.id] ?? 0;
          return (
            <div key={player.id} className="flex items-center gap-2">
              <div
                className="w-10 text-[10px] font-semibold text-right flex-shrink-0"
                style={{ color: player.color }}
              >
                {player.name}
              </div>
              <div className="flex-1 h-6 bg-[#f0e6d2] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-bold text-white min-w-[28px]"
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
        <div className="text-[9px] font-semibold text-[#8b5e3c] mb-2">
          Projected finish
        </div>
        <div className="flex gap-3">
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
                    className="text-lg font-extrabold"
                    style={{ color: player.color }}
                  >
                    ~R{round === Infinity ? "∞" : round}
                  </div>
                  <div className="text-[8px] text-[#8b5e3c]">
                    {player.name}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div className="text-[8px] text-[#8b5e3c] text-center mt-2 italic">
        Based on average scoring pace · updates each round
      </div>
    </div>
  );
}

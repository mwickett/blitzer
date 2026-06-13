import { type PlayerWithScore } from "../types";

interface HotColdCardProps {
  players: PlayerWithScore[];
  deltasByRound: Record<string, number[]>; // playerId -> delta per round
}

export function HotColdCard({ players, deltasByRound }: HotColdCardProps) {
  const roundCount = Object.values(deltasByRound)[0]?.length ?? 0;

  // Find the best round per player for fire emoji
  const bestRoundByPlayer: Record<string, number> = {};
  for (const player of players) {
    const deltas = deltasByRound[player.id] ?? [];
    let bestIdx = 0;
    for (let i = 1; i < deltas.length; i++) {
      if (deltas[i] > deltas[bestIdx]) bestIdx = i;
    }
    if (deltas[bestIdx] > 0) bestRoundByPlayer[player.id] = bestIdx;
  }

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Hot & Cold
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        Performance intensity per round
      </div>

      {/* Round headers */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-14 md:w-10 flex-shrink-0" aria-hidden="true" />
        <div className="flex flex-1 gap-1">
          {Array.from({ length: roundCount }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-xs md:text-[11px] text-[#8b5e3c] font-medium"
            >
              R{i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Player rows */}
      <div className="space-y-1.5">
        {players.map((player) => {
          const deltas = deltasByRound[player.id] ?? [];
          return (
            <div key={player.id} className="flex items-center gap-1.5">
              <div
                className="w-14 md:w-10 text-[13px] md:text-[11px] font-semibold text-right flex-shrink-0 truncate leading-tight"
                style={{ color: player.color }}
              >
                {player.name}
              </div>
              <div className="flex gap-1 flex-1">
                {deltas.map((d, ri) => {
                  const isBest = bestRoundByPlayer[player.id] === ri;
                  const isNeg = d < 0;
                  const isHot = d >= 10;

                  return (
                    <div
                      key={ri}
                      className="flex-1 h-10 md:h-9 rounded-md flex items-center justify-center text-[13px] md:text-[11px] font-bold relative tabular-nums leading-none"
                      style={{
                        backgroundColor: isNeg
                          ? "#b91c1c"
                          : isHot
                            ? player.color
                            : "#f0e6d2",
                        color:
                          isNeg || isHot ? "#fff" : "#8b5e3c",
                        opacity: isNeg ? 0.7 : isHot ? 1 : 0.8,
                      }}
                    >
                      {d > 0 ? `+${d}` : d}
                      {isBest && (
                        <span className="absolute -top-1 -right-0.5 text-[10px] md:text-[8px]">
                          🔥
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

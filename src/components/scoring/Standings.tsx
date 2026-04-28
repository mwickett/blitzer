import { type PlayerWithScore } from "./types";

interface StandingsProps {
  players: PlayerWithScore[];
  winThreshold: number;
}

export function Standings({ players, winThreshold }: StandingsProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  // Compute ranks with ties (players at the same score share a rank)
  const ranks: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i].score !== sorted[i - 1].score) {
      ranks.push(i + 1);
    } else {
      ranks.push(ranks[i - 1]);
    }
  }

  return (
    <div className="px-4 space-y-1.5">
      {sorted.map((player, i) => {
        const away = winThreshold - player.score;
        return (
          <div
            key={player.id}
            className="flex items-center justify-between py-2.5 px-3 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg"
            style={{ borderLeftWidth: "4px", borderLeftColor: player.color }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#8b5e3c] w-4">
                {ranks[i]}
              </span>
              <span className="text-[13px] font-semibold text-[#290806]">
                {player.name}
              </span>
            </div>
            <div className="text-right">
              <div
                className={`text-[15px] font-extrabold ${player.score < 0 ? "text-[#b91c1c]" : ""}`}
                style={{ color: player.score >= 0 ? player.color : undefined }}
              >
                {player.score}
              </div>
              <div className="text-[9px] text-[#8b5e3c]">{away} away</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

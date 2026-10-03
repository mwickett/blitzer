import { type PlayerWithScore } from "../types";

interface BlitzPileCardProps {
  players: PlayerWithScore[];
  /** playerId -> Blitz pile left per round; null when no score was saved. */
  blitzByRound: Record<string, (number | null)[]>;
}

/** Seven or more cards stuck in the Blitz pile is a rough round. */
export const HEAVY_BLITZ_PILE = 7;

export function BlitzPileCard({ players, blitzByRound }: BlitzPileCardProps) {
  const roundCount = Math.max(
    0,
    ...players.map((p) => blitzByRound[p.id]?.length ?? 0),
  );
  const blitzCounts = players
    .map((player) => ({
      player,
      count: (blitzByRound[player.id] ?? []).filter((left) => left === 0)
        .length,
    }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Blitz Pile
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        Cards left in each Blitz pile. Gold means they blitzed.
      </div>

      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-14 md:w-10 shrink-0" aria-hidden="true" />
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

      <div className="space-y-1.5">
        {players.map((player) => (
          <div key={player.id} className="flex items-center gap-1.5">
            <div
              className="w-14 md:w-10 text-[13px] md:text-[11px] font-semibold text-right shrink-0 truncate leading-tight"
              style={{ color: player.color }}
            >
              {player.name}
            </div>
            <div className="flex gap-1 flex-1">
              {(blitzByRound[player.id] ?? []).map((left, ri) => {
                const blitzed = left === 0;
                const heavy = left !== null && left >= HEAVY_BLITZ_PILE;
                return (
                  <div
                    key={ri}
                    role="img"
                    aria-label={
                      left === null
                        ? `${player.name}, round ${ri + 1}: no score`
                        : blitzed
                          ? `${player.name}, round ${ri + 1}: blitzed`
                          : `${player.name}, round ${ri + 1}: ${left} left`
                    }
                    className="flex-1 h-10 md:h-9 rounded-md flex items-center justify-center text-[13px] md:text-[11px] font-bold tabular-nums leading-none"
                    style={{
                      backgroundColor: blitzed
                        ? "#d4a017"
                        : heavy
                          ? "#b91c1c"
                          : "#f0e6d2",
                      color: blitzed ? "#290806" : heavy ? "#fff" : "#8b5e3c",
                    }}
                  >
                    {left === null ? "–" : blitzed ? "⚡" : left}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {blitzCounts.length > 0 && (
        <div className="mt-3 text-[13px] md:text-xs text-[#8b5e3c]">
          Blitzes:{" "}
          {blitzCounts.map(({ player, count }, i) => (
            <span key={player.id}>
              {i > 0 && ", "}
              <span className="font-semibold" style={{ color: player.color }}>
                {player.name}
              </span>{" "}
              {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { type PlayerWithScore } from "../types";

// The chart library loads after the page is usable; the box keeps its size
// meanwhile, and the chart only ever draws in the browser.
const ScoreProgressionChart = dynamic(() => import("./ScoreProgressionChart"), {
  ssr: false,
});

interface ScoreProgressionCardProps {
  players: PlayerWithScore[];
  scoresByRound: Record<string, number[]>; // playerId -> cumulative scores per round
  winThreshold: number;
}

export function ScoreProgressionCard({
  players,
  scoresByRound,
  winThreshold,
}: ScoreProgressionCardProps) {
  const data = useMemo(() => {
    const roundCount = Object.values(scoresByRound)[0]?.length ?? 0;
    return Array.from({ length: roundCount }, (_, i) => {
      const point: Record<string, number | string> = { round: i + 1 };
      for (const player of players) {
        point[player.id] = scoresByRound[player.id]?.[i] ?? 0;
      }
      return point;
    });
  }, [players, scoresByRound]);

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-base md:text-sm font-bold text-[#290806] mb-0.5">
        Score Progression
      </div>
      <div className="text-[13px] md:text-xs text-[#8b5e3c] mb-3">
        Cumulative scores across all rounds
      </div>
      <div className="h-[160px]">
        <ScoreProgressionChart
          data={data}
          players={players}
          winThreshold={winThreshold}
        />
      </div>
    </div>
  );
}

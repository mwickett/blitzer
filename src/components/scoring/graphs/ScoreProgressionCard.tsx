"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { type PlayerWithScore } from "../types";

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
  const roundCount =
    Object.values(scoresByRound)[0]?.length ?? 0;

  const data = Array.from({ length: roundCount }, (_, i) => {
    const point: Record<string, number | string> = { round: i + 1 };
    for (const player of players) {
      point[player.id] = scoresByRound[player.id]?.[i] ?? 0;
    }
    return point;
  });

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-[11px] font-bold text-[#290806] mb-0.5">
        Score Progression
      </div>
      <div className="text-[9px] text-[#8b5e3c] mb-3">
        Cumulative scores across all rounds
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d2" />
            <XAxis
              dataKey="round"
              tick={{ fontSize: 9, fill: "#8b5e3c" }}
              tickLine={false}
              axisLine={{ stroke: "#e6d7c3" }}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#8b5e3c" }}
              tickLine={false}
              axisLine={{ stroke: "#e6d7c3" }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid #e6d7c3",
              }}
            />
            <ReferenceLine
              y={winThreshold}
              stroke="#290806"
              strokeDasharray="4 3"
              strokeWidth={1}
              opacity={0.3}
            />
            <ReferenceLine y={0} stroke="#d1bfa8" strokeWidth={0.5} />
            {players.map((player) => (
              <Line
                key={player.id}
                dataKey={player.id}
                name={player.name}
                stroke={player.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

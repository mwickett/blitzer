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

export default function ScoreProgressionChart({
  data,
  players,
  winThreshold,
}: {
  data: Record<string, number | string>[];
  players: PlayerWithScore[];
  winThreshold: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d2" />
        <XAxis
          dataKey="round"
          tick={{ fontSize: 12, fill: "#8b5e3c" }}
          tickLine={false}
          axisLine={{ stroke: "#e6d7c3" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#8b5e3c" }}
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
  );
}

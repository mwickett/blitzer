"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const WIN = "#2a6517";
const LOSS = "#b91c1c";
const NEUTRAL = "#b8a08c";

export interface RecentScoresDatum {
  label: string;
  score: number;
  won: boolean | null;
  mark: string;
  result: string;
  detail: string;
}

export default function RecentScoresChart({ data }: { data: RecentScoresDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }}>
        <XAxis dataKey="label" hide />
        <YAxis
          tick={{ fontSize: 12, fill: "#8b5e3c" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <ReferenceLine y={0} stroke="#d1bfa8" />
        <Tooltip
          cursor={{ fill: "#faf5ed" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e6d7c3" }}
          labelFormatter={() => ""}
          formatter={(value, _name, item) => [
            `${value} points (${(item.payload as { detail: string }).detail})`,
            "",
          ]}
          separator=""
        />
        <Bar dataKey="score" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="mark" position="top" fontSize={11} fontWeight={700} fill="#5b4038" />
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.won === true ? WIN : entry.won === false ? LOSS : NEUTRAL}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { DisplayScores } from "@/lib/gameLogic";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Array of colors for different players' lines
const lineColors = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
];

interface ScoreLineGraphProps {
  displayScores: DisplayScores[];
}

export function ScoreLineGraph({ displayScores }: ScoreLineGraphProps) {
  // Transform the data for Recharts
  const chartData = displayScores[0]?.scoresByRound.map((_, roundIndex) => {
    const roundData: { [key: string]: any } = {
      round: roundIndex + 1,
    };

    // Add each player's score for this round
    displayScores.forEach((player, playerIndex) => {
      roundData[player.username] = player.scoresByRound[roundIndex] || 0;
    });

    return roundData;
  });

  if (!chartData?.length) return null;

  return (
    <div className="w-full h-[400px] bg-white dark:bg-gray-950 rounded-lg shadow-lg p-6 my-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="round"
            label={{ value: "Round", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            label={{ value: "Score", angle: -90, position: "insideLeft" }}
          />
          <Tooltip />
          <Legend />
          {displayScores.map((player, index) => (
            <Line
              key={player.userId}
              type="monotone"
              dataKey={player.username}
              stroke={lineColors[index % lineColors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

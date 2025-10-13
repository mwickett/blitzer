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
  ReferenceLine,
} from "recharts";

// Array of colors for different players' lines
const lineColors = [
  "#FD4C4E", // Red (important-comment)
  "#0168C7", // Blue (important-comment)
  "#049746", // Green (important-comment)
  "#FDD605", // Yellow (important-comment)
  "#8B5CF6", // Purple (important-comment)
  "#F97316", // Orange (important-comment)
  "#EC4899", // Pink (important-comment)
  "#06B6D4", // Cyan (important-comment)
  "#6366F1", // Indigo (important-comment)
  "#84CC16", // Lime (important-comment)
  "#F59E0B", // Amber (important-comment)
  "#14B8A6", // Teal (important-comment)
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
    <div className="w-full h-[300px] sm:h-[400px] bg-white dark:bg-gray-950 rounded-lg shadow-lg p-4 sm:p-6 my-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 16,
            right: 24,
            left: 8,
            bottom: 16,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="#666" strokeWidth={1} />
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

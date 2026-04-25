"use client";

import {
  calcTrackBounds,
  scoreToPosition,
  groupMarkers,
  type TrackMarker,
} from "@/lib/scoring/racetrack";
import { type PlayerWithScore } from "./types";

interface RaceTrackProps {
  players: PlayerWithScore[];
  winThreshold?: number;
  pillThreshold?: number;
}

export function RaceTrack({
  players,
  winThreshold = 75,
  pillThreshold = 8,
}: RaceTrackProps) {
  const scores = players.map((p) => p.score);
  const bounds = calcTrackBounds(scores, winThreshold);
  const zeroPos = scoreToPosition(0, bounds.min, bounds.max);

  const markers: TrackMarker[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    color: p.color,
  }));

  const groups = groupMarkers(markers, pillThreshold, bounds.min, bounds.max);

  return (
    <div className="w-full">
      <div className="flex justify-between text-[13px] md:text-[11px] text-[#8b5e3c] mb-1.5 px-0.5 pr-6">
        <span>{bounds.min}</span>
        <span>{winThreshold} to win</span>
      </div>

      <div className="relative h-11 bg-[#f0e6d2] rounded-full overflow-visible">
        {/* Zero line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[#d1bfa8]"
          style={{ left: `${zeroPos}%` }}
        />
        <div
          className="absolute -top-4 text-[13px] md:text-[11px] text-[#8b5e3c] -translate-x-1/2"
          style={{ left: `${zeroPos}%` }}
        >
          0
        </div>

        {/* Finish line */}
        <div className="absolute top-0 bottom-0 w-[3px] bg-[#290806] right-0 rounded-r-full" />
        <div className="absolute -top-5 right-[-2px] text-[12px]">🏁</div>

        {/* Pill groups */}
        {groups.map((group, gi) => {
          const pos = Math.max(3, Math.min(97, group.position));

          if (group.markers.length === 1) {
            const m = group.markers[0];
            return (
              <div
                key={gi}
                className="absolute top-1/2 z-10 transition-all duration-300"
                style={{
                  left: `${pos}%`,
                  transform: "translateX(-50%) translateY(-50%)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm flex items-center justify-center text-sm md:text-xs font-bold text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.score}
                </div>
              </div>
            );
          }

          return (
            <div
              key={gi}
              className="absolute top-1/2 z-10 transition-all duration-300"
              style={{
                left: `${pos}%`,
                transform: "translateX(-50%) translateY(-50%)",
              }}
            >
              <div className="flex h-8 rounded-full border-[2.5px] border-[#fff7ea] shadow-sm overflow-hidden">
                {group.markers.map((m) => (
                  <div
                    key={m.id}
                    className="min-w-[30px] md:min-w-[26px] h-full flex items-center justify-center text-[13px] md:text-[11px] font-bold text-white px-1.5"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.score}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend — ordered left-to-right to match on-track positions (ascending score) */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 px-0.5 text-[13px] md:text-[11px] font-medium">
        {[...players]
          .sort((a, b) => a.score - b.score)
          .map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span style={{ color: p.score < 0 ? "#b91c1c" : p.color }}>
                {p.name}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

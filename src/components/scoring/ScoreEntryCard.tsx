"use client";

import { useId } from "react";
import { StatusIndicator } from "./StatusIndicator";
import { type EntryStatus, type PlayerEntry } from "./types";
import { GAME_RULES } from "@/lib/validation/gameRules";

interface ScoreEntryCardProps {
  name: string;
  color: string;
  score: number;
  entry: PlayerEntry;
  status: EntryStatus;
  onUpdate: (
    field: "blitzRemaining" | "cardsPlayed",
    value: number | null,
  ) => void;
  deltaFlash?: number | null;
}

function handleNumericInput(
  value: string,
  max: number,
  onChange: (v: number | null) => void,
) {
  if (!/^\d*$/.test(value)) return;
  const raw = value;
  if (raw === "") {
    onChange(null);
    return;
  }
  const n = parseInt(raw, 10);
  if (!isNaN(n)) onChange(Math.min(max, Math.max(0, n)));
}

export function ScoreEntryCard({
  name,
  color,
  score,
  entry,
  status,
  onUpdate,
  deltaFlash,
}: ScoreEntryCardProps) {
  const id = useId();
  return (
    <div
      className="relative bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 flex items-center gap-2.5"
      style={{ borderLeftWidth: "5px", borderLeftColor: color }}
    >
      <div className="w-20 flex-shrink-0">
        <div className="break-words text-sm font-semibold text-[#290806]">
          {name}
        </div>
        <div
          className={`text-[11px] ${score < 0 ? "text-[#b91c1c]" : "text-[#8b5e3c]"}`}
        >
          {score} pts
        </div>
      </div>

      <div className="flex min-w-0 gap-2 flex-1 max-w-[280px]">
        <div className="flex-1">
          <label
            htmlFor={`${id}-blitz`}
            className="block min-h-8 text-xs text-[#8b5e3c] font-medium mb-1"
          >
            <span className="sr-only">{name} </span>
            Blitz left
          </label>
          <input
            id={`${id}-blitz`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={
              entry.blitzRemaining !== null ? String(entry.blitzRemaining) : ""
            }
            onChange={(e) =>
              handleNumericInput(
                e.target.value,
                GAME_RULES.MAX_BLITZ_PILE,
                (v) => onUpdate("blitzRemaining", v),
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label
            htmlFor={`${id}-cards`}
            className="block min-h-8 text-xs text-[#8b5e3c] font-medium mb-1"
          >
            <span className="sr-only">{name} </span>
            Cards played
          </label>
          <input
            id={`${id}-cards`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={entry.cardsPlayed !== null ? String(entry.cardsPlayed) : ""}
            onChange={(e) =>
              handleNumericInput(
                e.target.value,
                GAME_RULES.MAX_CARDS_PLAYED,
                (v) => onUpdate("cardsPlayed", v),
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
      </div>

      <StatusIndicator status={status} />

      {/* Delta flash overlay */}
      {deltaFlash !== null && deltaFlash !== undefined && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl animate-[deltaFlash_1.2s_ease-out_forwards] pointer-events-none"
          style={{ backgroundColor: deltaFlash >= 0 ? "#dcfce7" : "#fef2f2" }}
        >
          <span
            className={`text-2xl font-black ${deltaFlash >= 0 ? "text-[#2a6517]" : "text-[#b91c1c]"}`}
          >
            {deltaFlash > 0 ? `+${deltaFlash}` : deltaFlash}
          </span>
        </div>
      )}
    </div>
  );
}

"use client";

import { StatusIndicator } from "./StatusIndicator";
import { type EntryStatus, type PlayerEntry } from "./types";

interface ScoreEntryCardProps {
  name: string;
  color: string;
  score: number;
  entry: PlayerEntry;
  status: EntryStatus;
  onUpdate: (field: "blitzRemaining" | "cardsPlayed", value: number | null) => void;
}

function handleNumericInput(
  value: string,
  max: number,
  onChange: (v: number | null) => void
) {
  const raw = value.replace(/[^0-9]/g, "");
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
}: ScoreEntryCardProps) {
  return (
    <div
      className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 flex items-center gap-2.5"
      style={{ borderLeftWidth: "5px", borderLeftColor: color }}
    >
      <div className="w-16 flex-shrink-0">
        <div className="text-sm font-semibold text-[#290806]">{name}</div>
        <div
          className={`text-[11px] ${score < 0 ? "text-[#b91c1c]" : "text-[#8b5e3c]"}`}
        >
          {score} pts
        </div>
      </div>

      <div className="flex gap-2 flex-1">
        <div className="flex-1">
          <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">
            Blitz left
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={entry.blitzRemaining !== null ? String(entry.blitzRemaining) : ""}
            onChange={(e) =>
              handleNumericInput(e.target.value, 10, (v) =>
                onUpdate("blitzRemaining", v)
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[9px] text-[#8b5e3c] uppercase tracking-wider font-medium mb-1">
            Cards played
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={entry.cardsPlayed !== null ? String(entry.cardsPlayed) : ""}
            onChange={(e) =>
              handleNumericInput(e.target.value, 40, (v) =>
                onUpdate("cardsPlayed", v)
              )
            }
            className="w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-none transition-colors"
            placeholder="—"
          />
        </div>
      </div>

      <StatusIndicator status={status} />
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { StatusIndicator } from "./StatusIndicator";
import { type EntryMode, type EntryStatus, type PlayerEntry } from "./types";
import { GAME_RULES } from "@/lib/validation/gameRules";

interface ScoreEntryCardProps {
  name: string;
  color: string;
  score: number;
  entry: PlayerEntry;
  status: EntryStatus;
  mode?: EntryMode;
  onUpdate: (field: keyof PlayerEntry, value: number | null) => void;
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

const inputClass =
  "w-full h-11 bg-[#fff7ea] border-[1.5px] border-[#e6d7c3] rounded-lg text-[#290806] text-xl font-semibold text-center focus:border-[#8b5e3c] focus:outline-hidden transition-colors";

/**
 * "Do math" entry: one round total. Phone number pads have no minus key, so
 * the sign is a separate toggle and the field takes digits only.
 */
function TotalInput({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  // The toggle only needs its own state while there is no non-zero value.
  const [signPressed, setNegative] = useState(value !== null && value < 0);
  const negative = value ? value < 0 : signPressed;
  const magnitude = value === null ? "" : String(Math.abs(value));
  const apply = (digits: number | null, isNegative: boolean) => {
    if (digits === null) return onChange(null);
    const signed = isNegative ? -digits : digits;
    onChange(
      Math.min(
        GAME_RULES.MAX_ROUND_SCORE,
        Math.max(GAME_RULES.MIN_ROUND_SCORE, signed),
      ) || 0,
    );
  };
  return (
    <div className="flex-1">
      <label
        htmlFor={`${id}-total`}
        className="block min-h-8 text-xs text-[#8b5e3c] font-medium mb-1"
      >
        <span className="sr-only">{name} </span>
        Round score
      </label>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-pressed={negative}
          aria-label={`${name} score is negative`}
          onClick={() => {
            setNegative(!negative);
            apply(value === null ? null : Math.abs(value), !negative);
          }}
          className={`h-11 w-11 shrink-0 rounded-lg border-[1.5px] text-xl font-bold ${
            negative
              ? "border-[#b91c1c] bg-[#fef2f2] text-[#b91c1c]"
              : "border-[#e6d7c3] bg-[#fff7ea] text-[#8b5e3c]"
          }`}
        >
          −
        </button>
        <input
          id={`${id}-total`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={magnitude}
          onChange={(e) => {
            const raw = e.target.value;
            // Desktop keyboards can type the sign directly.
            const typedNegative = raw.startsWith("-");
            const digits = typedNegative ? raw.slice(1) : raw;
            if (!/^\d*$/.test(digits)) return;
            const isNegative = typedNegative || negative;
            if (typedNegative) setNegative(true);
            apply(digits === "" ? null : parseInt(digits, 10), isNegative);
          }}
          className={`${inputClass} ${negative ? "text-[#b91c1c]" : ""}`}
          placeholder="—"
        />
      </div>
    </div>
  );
}

export function ScoreEntryCard({
  name,
  color,
  score,
  entry,
  status,
  mode = "cards",
  onUpdate,
  deltaFlash,
}: ScoreEntryCardProps) {
  const id = useId();
  return (
    <div
      className="relative bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3 flex items-center gap-2.5"
      style={{ borderLeftWidth: "5px", borderLeftColor: color }}
    >
      <div className="w-20 shrink-0">
        <div className="wrap-break-word text-sm font-semibold text-[#290806]">
          {name}
        </div>
        <div
          className={`text-[11px] ${score < 0 ? "text-[#b91c1c]" : "text-[#8b5e3c]"}`}
        >
          {score} pts
        </div>
      </div>

      <div className="flex min-w-0 gap-2 flex-1 max-w-[280px]">
        {mode === "total" ? (
          <TotalInput
            name={name}
            value={entry.total}
            onChange={(value) => onUpdate("total", value)}
          />
        ) : (
          <>
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
                  entry.blitzRemaining !== null
                    ? String(entry.blitzRemaining)
                    : ""
                }
                onChange={(e) =>
                  handleNumericInput(
                    e.target.value,
                    GAME_RULES.MAX_BLITZ_PILE,
                    (v) => onUpdate("blitzRemaining", v),
                  )
                }
                className={inputClass}
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
                value={
                  entry.cardsPlayed !== null ? String(entry.cardsPlayed) : ""
                }
                onChange={(e) =>
                  handleNumericInput(
                    e.target.value,
                    GAME_RULES.MAX_CARDS_PLAYED,
                    (v) => onUpdate("cardsPlayed", v),
                  )
                }
                className={inputClass}
                placeholder="—"
              />
            </div>
          </>
        )}
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

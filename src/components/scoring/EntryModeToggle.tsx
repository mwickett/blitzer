"use client";

import { type EntryMode } from "./types";

const OPTIONS: { mode: EntryMode; label: string }[] = [
  { mode: "cards", label: "Cards + Blitz" },
  { mode: "total", label: "Round totals" },
];

/** Switches between entering the card breakdown and "Do math" totals. */
export function EntryModeToggle({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="How to enter scores"
      className="inline-flex rounded-lg border-[1.5px] border-[#e6d7c3] bg-[#fff7ea] p-0.5 text-xs font-semibold"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={mode === option.mode}
          onClick={() => {
            if (mode !== option.mode) onChange(option.mode);
          }}
          className={`rounded-md px-3 py-1.5 ${
            mode === option.mode ? "bg-[#8b5e3c] text-white" : "text-[#8b5e3c]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

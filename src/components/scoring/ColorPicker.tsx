"use client";

import { ACCENT_COLORS } from "@/lib/scoring/colors";

export function ColorPicker({
  value,
  onChange,
  usedColors = [],
}: {
  value: string | null;
  onChange: (color: string) => void;
  usedColors?: string[];
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ACCENT_COLORS.map((c) => {
        const isUsed = usedColors.includes(c.value) && c.value !== value;
        const isSelected = value === c.value;
        return (
          <button
            key={c.value}
            onClick={() => !isUsed && onChange(c.value)}
            className={`w-9 h-9 rounded-full border-2 transition-all ${
              isSelected
                ? "border-[#290806] scale-110 shadow-sm"
                : isUsed
                  ? "border-transparent opacity-25 cursor-not-allowed"
                  : "border-transparent hover:border-[#d1bfa8] cursor-pointer"
            }`}
            style={{ backgroundColor: c.value }}
            title={isUsed ? `${c.label} (taken)` : c.label}
            disabled={isUsed}
            aria-label={`${c.label}${isSelected ? " (selected)" : ""}${isUsed ? " (taken)" : ""}`}
          />
        );
      })}
    </div>
  );
}

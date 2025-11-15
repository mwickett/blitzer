"use client";

import { CARD_COLOURS } from "@/lib/cardColours";
import { cn } from "@/lib/utils";

interface CardColourSelectorProps {
  value: string | null | undefined;
  onChange: (colour: string | null) => void;
  className?: string;
}

export function CardColourSelector({
  value,
  onChange,
  className,
}: CardColourSelectorProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {CARD_COLOURS.map((colour) => (
        <button
          key={colour.value}
          type="button"
          onClick={() => onChange(value === colour.value ? null : colour.value)}
          className={cn(
            "h-8 w-8 rounded-full border-2 transition-all hover:scale-110",
            value === colour.value
              ? "border-gray-900 ring-2 ring-gray-400 ring-offset-2"
              : "border-gray-300 hover:border-gray-500"
          )}
          style={{ backgroundColor: colour.hex }}
          title={colour.label}
          aria-label={`Select ${colour.label} colour`}
        />
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="h-8 px-3 rounded text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Clear colour"
        >
          Clear
        </button>
      )}
    </div>
  );
}

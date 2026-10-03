"use client";

import { DECKS, type DeckId } from "@/lib/scoring/decks";
import { DeckIcon } from "./DeckIcon";

/** Optional deck pick; choosing the selected deck again clears it. */
export function DeckPicker({
  value,
  onChange,
  playerName,
}: {
  value: DeckId | null;
  onChange: (deck: DeckId | null) => void;
  playerName: string;
}) {
  return (
    <div role="group" aria-label={`Deck for ${playerName} (optional)`} className="flex flex-wrap gap-1.5">
      {DECKS.map((deck) => {
        const selected = value === deck.id;
        return (
          <button
            key={deck.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : deck.id)}
            className={`flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? "border-[#290806] bg-[#290806] text-[#fff7ea]"
                : "border-[#e6d7c3] text-[#5a341f] hover:border-[#d1bfa8]"
            }`}
          >
            <DeckIcon deck={deck.id} className="h-4 w-4" />
            {deck.label}
          </button>
        );
      })}
    </div>
  );
}

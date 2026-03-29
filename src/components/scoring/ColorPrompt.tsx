"use client";

import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

interface ColorPromptProps {
  playerName: string;
  usedColors: string[];
  onSelect: (color: string, saveAsDefault: boolean) => void;
}

export function ColorPrompt({
  playerName,
  usedColors,
  onSelect,
}: ColorPromptProps) {
  const firstAvailable = ACCENT_COLORS.find(
    (c) => !usedColors.includes(c.value)
  );
  const [selected, setSelected] = useState<string | null>(
    firstAvailable?.value ?? null
  );
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  return (
    <div className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-4">
      <div className="text-sm font-bold text-[#290806] mb-1">
        Choose your color, {playerName}
      </div>
      <div className="text-xs text-[#8b5e3c] mb-3">
        Pick the color that matches your Dutch Blitz deck
      </div>

      <ColorPicker
        value={selected}
        onChange={setSelected}
        usedColors={usedColors}
      />

      <label className="flex items-center gap-2 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={saveAsDefault}
          onChange={(e) => setSaveAsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-[#e6d7c3] accent-[#290806]"
        />
        <span className="text-xs text-[#8b5e3c]">
          Save as my default color
        </span>
      </label>

      <button
        onClick={() => selected && onSelect(selected, saveAsDefault)}
        disabled={!selected}
        className={`w-full mt-3 py-2.5 rounded-lg text-sm font-bold transition-colors ${
          selected
            ? "bg-[#290806] text-white cursor-pointer"
            : "bg-[#f0e6d2] text-[#d1bfa8] cursor-not-allowed"
        }`}
      >
        Confirm
      </button>
    </div>
  );
}

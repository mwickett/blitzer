// src/components/scoring/GameColorStep.tsx
"use client";

import { useState } from "react";
import { ColorPicker } from "./ColorPicker";
import { useGameColors, type ColorStepPlayer } from "./useGameColors";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PlayCircle, ArrowLeft } from "lucide-react";

interface GameColorStepProps {
  players: ColorStepPlayer[];
  onConfirm: (colors: Record<string, string>, saveCreatorDefault: boolean) => void;
  onBack: () => void;
}

export function GameColorStep({ players, onConfirm, onBack }: GameColorStepProps) {
  const { colors, updateColor } = useGameColors(players);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-[#5a341f] mb-1">
        Pick a color for each player
      </div>

      {players.map((player) => {
        const usedByOthers = Object.entries(colors)
          .filter(([id]) => id !== player.id)
          .map(([, c]) => c);

        return (
          <div
            key={player.id}
            className="bg-white border-[1.5px] border-[#e6d7c3] rounded-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-7 w-7">
                {player.avatarUrl ? (
                  <AvatarImage src={player.avatarUrl} alt={player.name} />
                ) : (
                  <AvatarFallback className="bg-[#f0e6d2] text-[#2a0e02] text-xs">
                    {getInitials(player.name)}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="text-sm font-semibold text-[#290806]">
                {player.name}
              </span>
              {player.isCurrentUser && (
                <span className="text-xs bg-[#f0e6d2] text-[#5a341f] px-2 py-0.5 rounded-full">
                  You
                </span>
              )}
              {player.isGuest && (
                <span className="text-xs bg-[#e6d7c3] text-[#5a341f] px-2 py-0.5 rounded-full">
                  Guest
                </span>
              )}
            </div>

            <ColorPicker
              value={colors[player.id] ?? null}
              onChange={(color) => updateColor(player.id, color)}
              usedColors={usedByOthers}
            />

            {player.isCurrentUser && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
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
            )}

            {player.isGuest && (
              <p className="text-xs text-[#b8a08c] italic mt-2">
                Color saved to this game only
              </p>
            )}
          </div>
        );
      })}

      <div className="flex justify-between items-center pt-2 border-t border-[#e6d7c3]">
        <Button type="button" variant="ghost" size="sm" className="text-[#5a341f]" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button
          className="bg-[#2a6517] hover:bg-[#1d4a10] text-white font-medium px-6"
          onClick={() => onConfirm(colors, saveAsDefault)}
        >
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Game
        </Button>
      </div>
    </div>
  );
}
